import * as vscode from "vscode";
import * as crypto from "crypto";
import { functionIndexInstance, CallGraphEdge } from "../analyzer/functionIndex";
import { t, getLanguage } from "../utils/i18n";

const HTML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
};

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

const STYLE = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-editor-foreground, #ccc); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; width: 100vw; height: 100vh; }
svg { width: 100%; height: 100%; cursor: move; display: block; background: transparent; }
.links line { stroke-opacity: 0.6; stroke-width: 1.5px; }
.links line.unconditional { stroke: #4fc3f7; }
.links line.conditional { stroke: #ffb74d; stroke-dasharray: 5,5; }
.nodes rect { stroke: #333; stroke-width: 1px; rx: 4; ry: 4; cursor: pointer; }
.nodes text { font-size: 11px; fill: #fff; pointer-events: none; text-anchor: middle; dominant-baseline: central; }
.nodes g:hover rect { stroke: #fff; stroke-width: 2px; }
.arrow { fill: #4fc3f7; }
.arrow.conditional { fill: #ffb74d; }
.legend { font-size: 12px; fill: #ccc; }
#controls { position: fixed; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
.btn-group { display: flex; gap: 4px; }
button { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); border: none; padding: 6px 12px; cursor: pointer; font-size: 12px; border-radius: 2px; }
button:hover { opacity: 0.9; }
#status { position: fixed; bottom: 12px; right: 12px; font-size: 12px; color: #888; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; }
#error-display { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff5252; background: #2d2d2d; padding: 20px; border: 1px solid #ff5252; display: none; z-index: 1000; }
`;

// Static client-side script. All dynamic data and localized strings come in via window.__init,
// so this body never needs string interpolation from TypeScript.
const SCRIPT_BODY = `
(function() {
    const init = window.__init;
    const loc = init.loc;
    const errorDisplay = document.getElementById('error-display');
    const status = document.getElementById('status');

    function showError(msg) {
        errorDisplay.textContent = msg;
        errorDisplay.style.display = 'block';
        status.style.display = 'none';
    }

    function tr(template, params) {
        return template.replace(/\\{(\\w+)\\}/g, function(_, k) {
            return params[k] !== undefined ? params[k] : '';
        });
    }

    window.onerror = function(msg, _url, line) {
        showError(tr(loc.errorJs, { message: msg, line: line }));
        return false;
    };

    if (typeof d3 === 'undefined') {
        showError(loc.errorD3);
        return;
    }

    try {
        const nodes = init.nodes;
        const links = init.links;
        const svg = d3.select('#canvas');

        let width = window.innerWidth;
        let height = window.innerHeight;

        const g = svg.append('g');
        const zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', (e) => g.attr('transform', e.transform));
        svg.call(zoom);

        svg.append('defs').selectAll('marker')
            .data(['unconditional', 'conditional'])
            .enter().append('marker')
            .attr('id', d => 'arrow-' + d)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 22).attr('refY', 0)
            .attr('markerWidth', 6).attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('class', d => 'arrow ' + d);

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(60))
            .force('x', d3.forceX(width / 2).strength(0.05))
            .force('y', d3.forceY(height / 2).strength(0.05));

        const link = g.append('g').attr('class', 'links')
            .selectAll('line').data(links).enter().append('line')
            .attr('class', d => d.isConditional ? 'conditional' : 'unconditional')
            .attr('marker-end', d => 'url(#arrow-' + (d.isConditional ? 'conditional' : 'unconditional') + ')');

        const nsColors = {};
        const palette = ['#264f78', '#3e5c2a', '#5c3a6e', '#6e5c3a', '#3a5c6e', '#6e3a3a'];
        let colorIdx = 0;
        function getNsColor(ns) {
            if (!nsColors[ns]) { nsColors[ns] = palette[colorIdx++ % palette.length]; }
            return nsColors[ns];
        }

        const node = g.append('g').attr('class', 'nodes')
            .selectAll('g').data(nodes).enter().append('g')
            .call(d3.drag()
                .on('start', (e, d) => {
                    if (!e.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end', (e, d) => {
                    if (!e.active) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                }));

        node.each(function(d) {
            const el = d3.select(this);
            const text = el.append('text').text(d.label);
            const bbox = text.node().getBBox();
            const w = Math.max(bbox.width + 20, 40);
            const h = 24;
            el.insert('rect', 'text')
                .attr('x', -w/2).attr('y', -h/2)
                .attr('width', w).attr('height', h)
                .attr('fill', getNsColor(d.ns));
            el.append('title').text(d.id);
        });

        simulation.on('tick', () => {
            link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
        });

        simulation.on('end', () => {
            status.innerText = tr(loc.done, { count: nodes.length });
            setTimeout(() => { status.style.opacity = '0.5'; }, 2000);
        });

        document.getElementById('zoomIn').onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
        document.getElementById('zoomOut').onclick = () => svg.transition().call(zoom.scaleBy, 0.7);
        document.getElementById('resetView').onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);

        window.addEventListener('resize', () => {
            width = window.innerWidth;
            height = window.innerHeight;
            simulation.force('center', d3.forceCenter(width / 2, height / 2)).alpha(0.3).restart();
        });

        const legend = svg.append('g').attr('transform', 'translate(20,' + (height - 60) + ')');
        const l1 = legend.append('g').attr('transform', 'translate(0,0)');
        l1.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 30).attr('y2', 0)
            .style('stroke', '#4fc3f7').style('stroke-width', '2px');
        l1.append('text').attr('x', 40).attr('y', 4).attr('class', 'legend').text(loc.unconditional);
        const l2 = legend.append('g').attr('transform', 'translate(0,25)');
        l2.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 30).attr('y2', 0)
            .style('stroke', '#ffb74d').style('stroke-dasharray', '5,5').style('stroke-width', '2px');
        l2.append('text').attr('x', 40).attr('y', 4).attr('class', 'legend').text(loc.conditional);
    } catch (e) {
        showError(tr(loc.errorInit, { message: e.message }));
    }
})();
`;

interface D3Node {
    id: string;
    label: string | undefined;
    ns: string;
}

interface D3Link {
    source: string;
    target: string;
    isConditional: boolean;
}

interface InitPayload {
    nodes: D3Node[];
    links: D3Link[];
    loc: {
        conditional: string;
        unconditional: string;
        done: string;
        errorD3: string;
        errorJs: string;
        errorInit: string;
    };
}

function buildInitPayload(nodes: string[], edges: CallGraphEdge[]): InitPayload {
    const d3Nodes: D3Node[] = nodes.map((id) => ({
        id,
        label: id.includes(":") ? id.split(":").pop() : id,
        ns: id.includes(":") ? id.split(":")[0] : "default",
    }));
    const nodeSet = new Set(nodes);
    const d3Links: D3Link[] = edges
        .filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to))
        .map((e) => ({ source: e.from, target: e.to, isConditional: e.isConditional }));

    return {
        nodes: d3Nodes,
        links: d3Links,
        loc: {
            conditional: t("dependencyGraphConditional"),
            unconditional: t("dependencyGraphUnconditional"),
            done: t("dependencyGraphDone"),
            errorD3: t("dependencyGraphErrorD3"),
            errorJs: t("dependencyGraphErrorJs"),
            errorInit: t("dependencyGraphErrorInit"),
        },
    };
}

function buildEmptyHtml(): string {
    const noData = escapeHtml(t("dependencyGraphNoFunctions"));
    return `<!DOCTYPE html><html><body><h2 style="color:#ccc;text-align:center;padding:50px;">${noData}</h2></body></html>`;
}

function getWebviewContent(nodes: string[], edges: CallGraphEdge[], nonce: string): string {
    if (nodes.length === 0) {
        return buildEmptyHtml();
    }

    const init = buildInitPayload(nodes, edges);
    // Escape "<" so the JSON cannot terminate the surrounding <script> tag.
    const safeInit = JSON.stringify(init).replace(/</g, "\\u003c");

    const lang = escapeHtml(getLanguage());
    const loading = escapeHtml(t("dependencyGraphLoading"));
    const reset = escapeHtml(t("dependencyGraphReset"));

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src 'none'; connect-src https://cdn.jsdelivr.net;">
<style>${STYLE}</style>
</head>
<body>
<div id="error-display"></div>
<div id="controls">
    <div class="btn-group">
        <button id="zoomIn">+</button>
        <button id="zoomOut">-</button>
        <button id="resetView">${reset}</button>
    </div>
</div>
<div id="status">${loading}</div>
<svg id="canvas"></svg>
<script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script nonce="${nonce}">
window.__init = ${safeInit};
${SCRIPT_BODY}
</script>
</body>
</html>`;
}

function getNonce(): string {
    return crypto.randomBytes(24).toString("base64").replace(/[+/=]/g, "");
}

export function showDependencyGraph() {
    if (!functionIndexInstance.isInitialized()) {
        vscode.window.showWarningMessage(t("dependencyGraphIndexNotReady"));
        return;
    }

    const { nodes, edges } = functionIndexInstance.getCallGraph();

    const panel = vscode.window.createWebviewPanel(
        "dependencyGraph",
        t("dependencyGraphTitle"),
        vscode.ViewColumn.One,
        { enableScripts: true },
    );

    panel.webview.html = getWebviewContent(nodes, edges, getNonce());
}
