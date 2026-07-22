"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  GripVertical,
  History,
  Info,
  Keyboard,
  Link2,
  ListFilter,
  Menu,
  MoreHorizontal,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  calculatePlanReviewFee,
  evidence,
  FlowNodeData,
  initialEdges,
  initialIssues,
  initialNodes,
  Origin,
  ReviewIssue,
  toMermaid,
  validateGraph,
} from "@/lib/govflow";

type FlowNode = Node<FlowNodeData>;
type HistoryState = { nodes: FlowNode[]; edges: Edge[] };

const sourceRows = [
  { title: "Building Permit Application.pdf", meta: "3 pages · Native text", icon: FileText, status: "Ready" },
  { title: "Commercial Submittal Checklist.pdf", meta: "6 pages · OCR on 2 pages", icon: FileText, status: "Ready" },
  { title: "FY2025 Development Fees.csv", meta: "42 rows · Structured", icon: FileSpreadsheet, status: "Conflict" },
  { title: "Permit Review Instructions.html", meta: "Snapshot · Jul 22, 2026", icon: Link2, status: "Ready" },
];

function downloadText(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function OriginPill({ origin }: { origin: Origin }) {
  return <span className={`origin origin-${origin}`}>{origin.replace("_", " ")}</span>;
}

function Workspace() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges as Edge[]);
  const [issues, setIssues] = useState<ReviewIssue[]>(initialIssues);
  const [selectedId, setSelectedId] = useState("payment");
  const [activeSource, setActiveSource] = useState("FY2025 Development Fees.csv");
  const [leftTab, setLeftTab] = useState<"source" | "issues">("source");
  const [modal, setModal] = useState<"shadow" | "conflict" | "publish" | "none">("none");
  const [toast, setToast] = useState("");
  const [published, setPublished] = useState(false);
  const [revision, setRevision] = useState(7);
  const [feeInput, setFeeInput] = useState("2500");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const history = useRef<HistoryState[]>([]);
  const future = useRef<HistoryState[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const selectedEvidence = selectedNode?.data.evidence[0];
  const openIssues = issues.filter((issue) => issue.status === "open");
  const validation = useMemo(() => validateGraph(nodes, edges, issues), [nodes, edges, issues]);

  const saveHistory = useCallback(() => {
    history.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (history.current.length > 30) history.current.shift();
    future.current = [];
  }, [nodes, edges]);

  const selectNode = useCallback((_: React.MouseEvent, node: FlowNode) => {
    setSelectedId(node.id);
    const source = node.data.evidence[0]?.documentTitle;
    if (source) setActiveSource(source);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    saveHistory();
    setEdges((current) => addEdge(connection, current));
    setRevision((value) => value + 1);
  }, [saveHistory, setEdges]);

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  const addShadowStep = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const label = String(data.get("description") || "Zoning desk check");
    saveHistory();
    const id = `shadow-${crypto.randomUUID()}`;
    const userEvidence = { ...evidence.intake, documentVersionId: crypto.randomUUID(), documentTitle: "Shadow process note", pageNumber: 1, bbox: [0, 0, 1, 1] as [number, number, number, number], text: label, textStart: 0, textEnd: label.length, sourceHash: "user-authored", extractionMethod: "user" as const };
    setNodes((current) => [...current, { id, position: { x: 150, y: 705 }, data: { label, kind: "staff_task", actor: "Planning Desk", origin: "user_added", confidence: 1, reviewStatus: "reviewed", evidence: [userEvidence], description: `${String(data.get("duration"))} operational note by ${String(data.get("author"))}.` } }]);
    setEdges((current) => [...current, { id: `e-${id}-payment`, source: id, target: "payment", animated: true }]);
    setSelectedId(id);
    setRevision((value) => value + 1);
    setModal("none");
    showToast("Shadow-process step added with author and provenance");
  };

  const resolveConflict = (form: HTMLFormElement) => {
    const data = new FormData(form);
    setIssues((current) => current.map((issue) => issue.id === "issue-fee" ? { ...issue, status: "resolved" } : issue));
    setNodes((current) => current.map((node) => node.id === "payment" ? { ...node, data: { ...node.data, origin: "explicit", confidence: 1, reviewStatus: "reviewed", description: `Controlling fee: $${data.get("fee")}. Resolution: ${data.get("reason")}` } } : node));
    setRevision((value) => value + 1);
    setModal("none");
    showToast("Conflict resolution recorded in the audit history");
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  };

  const reviewIssue = (id: string) => {
    const issue = issues.find((item) => item.id === id);
    if (!issue) return;
    if (id === "issue-fee") return setModal("conflict");
    setIssues((current) => current.map((item) => item.id === id ? { ...item, status: "resolved" } : item));
    if (issue.nodeId) setSelectedId(issue.nodeId);
    setRevision((value) => value + 1);
    showToast("Reviewer decision saved");
  };

  const attemptPublish = () => {
    if (!validation.valid) {
      setModal("publish");
      return;
    }
    setPublished(true);
    showToast("Workflow v1.0 published as an immutable version");
  };

  const exportCanonical = () => {
    const canonical = {
      schema_version: "1.0.0",
      workflow_id: "demo-commercial-building-permit",
      project_id: "example-city-commercial-permit",
      title: "Commercial Building Permit",
      jurisdiction: { name: "Example City", state_or_region: "California", country: "US" },
      sources: sourceRows.map((source) => ({ title: source.title, status: source.status })),
      actors: [...new Set(nodes.map((node) => node.data.actor))],
      fields: [{ id: "project_square_footage", key: "project_square_footage", label: "Project square footage", type: "decimal", required_status: "explicitly_required", origin: "explicit", confidence: 0.98, evidence: [evidence.intake] }],
      requirements: [], statuses: ["received", "in_review", "approved"],
      workflow: { nodes, edges }, decision_rules: [],
      fee_rules: [{ id: "commercial-plan-review", currency: "USD", calculation: { op: "max", args: [{ literal_minor_units: 50000 }, { op: "multiply", args: [{ ref: "fields.project_square_footage" }, { literal_minor_units: 25 }] }] }, evidence: [evidence.payment] }],
      deadlines: [], issues,
      metadata: { created_at: new Date().toISOString(), pipeline_version: "0.1.0", prompt_version: "staged-extraction-v1", model_runs: [{ provider: "deterministic-mock", model: "fixture-v1" }] },
    };
    downloadText("govflow-workflow-v1.json", JSON.stringify(canonical, null, 2), "application/json");
    showToast("Canonical GovFlow JSON exported");
  };

  const handleUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const allowed = Array.from(files).filter((file) => /\.(pdf|csv)$/i.test(file.name));
    if (allowed.length !== files.length) showToast("Only PDF and CSV sources are supported in this MVP");
    if (allowed.length) {
      setUploaded((current) => [...current, ...allowed.map((file) => file.name)]);
      showToast(`${allowed.length} source${allowed.length > 1 ? "s" : ""} accepted for deterministic inspection`);
    }
  };

  const feeCents = (() => {
    try { return calculatePlanReviewFee(Number(feeInput)); } catch { return null; }
  })();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-block">
          <button className="icon-button mobile-only" aria-label="Open navigation"><Menu size={18} /></button>
          <div className="brand-mark" aria-hidden="true"><span>G</span></div>
          <div><div className="brand-name">GovFlow <span>AI</span></div><div className="brand-tagline">Policy compilation workspace</div></div>
        </div>
        <div className="project-crumb">
          <button className="icon-button" aria-label="Back to projects"><ArrowLeft size={17} /></button>
          <div><div className="eyebrow">Example City · Building &amp; Safety</div><h1>Commercial Building Permit</h1></div>
          <button className="icon-button" aria-label="Project menu"><ChevronDown size={16} /></button>
        </div>
        <div className="top-actions">
          <div className="draft-badge"><span className="draft-dot" /> Draft — requires authorized municipal review</div>
          <button className="button ghost" onClick={() => showToast(validation.valid ? "All deterministic checks passed" : `${validation.blocking.length} publication blockers remain`)}><ShieldCheck size={16} /> Validate</button>
          <button className="button primary" onClick={attemptPublish}>{published ? <CircleCheck size={16} /> : <Sparkles size={16} />}{published ? "Published v1.0" : "Publish"}</button>
          <button className="avatar" aria-label="Account menu">KO</button>
        </div>
      </header>

      <section className="status-strip" aria-label="Analysis status">
        <div className="analysis-state"><CircleCheck size={15} /><strong>Analysis complete</strong><span>4 sources · 12 claims · 9 workflow steps</span></div>
        <div className="issue-summary"><button onClick={() => setLeftTab("issues")}><span className="severity fatal" /> {openIssues.filter((issue) => issue.severity === "fatal").length} fatal</button><button onClick={() => setLeftTab("issues")}><span className="severity blocking" /> {openIssues.filter((issue) => issue.severity === "blocking").length} blocking</button><button onClick={() => setLeftTab("issues")}><span className="severity warning" /> {openIssues.filter((issue) => issue.severity === "warning").length} warning</button></div>
        <div className="revision"><History size={15} /> Draft revision {revision} <span>Saved just now</span></div>
      </section>

      <section className="workspace-grid">
        <aside className="source-pane" aria-label="Source documents and issues">
          <div className="pane-tabs" role="tablist">
            <button className={leftTab === "source" ? "active" : ""} onClick={() => setLeftTab("source")} role="tab"><FileText size={15} /> Sources <span>4</span></button>
            <button className={leftTab === "issues" ? "active" : ""} onClick={() => setLeftTab("issues")} role="tab"><AlertTriangle size={15} /> Issues <span>{openIssues.length}</span></button>
          </div>
          {leftTab === "source" ? <>
            <div className="source-tools">
              <label className="search"><Search size={15} /><input aria-label="Search sources" placeholder="Search source text" /></label>
              <button className="icon-button" aria-label="Filter sources"><ListFilter size={16} /></button>
            </div>
            <div className="source-list">
              {sourceRows.map(({ title, meta, icon: Icon, status }) => <button key={title} className={`source-row ${activeSource === title ? "active" : ""}`} onClick={() => setActiveSource(title)}><Icon size={18} /><span><strong>{title}</strong><small>{meta}</small></span><span className={`source-status ${status.toLowerCase()}`}>{status}</span></button>)}
              {uploaded.map((name) => <button key={name} className="source-row"><FileText size={18} /><span><strong>{name}</strong><small>Queued · secure local upload</small></span><span className="source-status queued">Queued</span></button>)}
            </div>
            <div className="source-preview-header"><span>Page {selectedEvidence?.pageNumber ?? 1} of {activeSource.includes("Checklist") ? 6 : activeSource.includes("Application") ? 3 : 1}</span><div><button aria-label="Zoom out"><ZoomOut size={15} /></button><strong>100%</strong><button aria-label="Zoom in"><ZoomIn size={15} /></button></div></div>
            <div className="document-stage">
              <div className="paper">
                <div className="city-seal">EXAMPLE CITY</div>
                <div className="document-kicker">BUILDING &amp; SAFETY DEPARTMENT</div>
                <h2>{activeSource.includes("Fees") ? "FY 2025 DEVELOPMENT FEES" : activeSource.includes("Checklist") ? "COMMERCIAL SUBMITTAL CHECKLIST" : activeSource.includes("Instructions") ? "PERMIT REVIEW INSTRUCTIONS" : "BUILDING PERMIT APPLICATION"}</h2>
                <div className="paper-rule" />
                <div className="paper-copy muted-lines"><span /><span /><span /></div>
                <div className="highlight-box" aria-label="Highlighted source evidence"><span className="evidence-tag">Evidence · {selectedEvidence?.extractionMethod.replace("_", " ") ?? "source"}</span><p>{selectedEvidence?.text ?? "Select a workflow item to view its supporting source."}</p></div>
                <div className="form-grid"><span /><span /><span /><span /><span /><span /></div>
              </div>
            </div>
            <div className="evidence-excerpt"><div><Link2 size={14} /> Exact excerpt</div><p>“{selectedEvidence?.text ?? "No evidence selected."}”</p><small>{selectedEvidence?.documentTitle} · page {selectedEvidence?.pageNumber} · {selectedEvidence?.extractionMethod.replace("_", " ")}</small></div>
          </> : <div className="issues-list">
            <div className="issues-heading"><div><strong>Review queue</strong><span>{openIssues.length} unresolved items</span></div><button className="icon-button" aria-label="Filter issues"><ListFilter size={16} /></button></div>
            {issues.map((issue) => <button key={issue.id} disabled={issue.status !== "open"} className={`issue-card ${issue.severity}`} onClick={() => reviewIssue(issue.id)}><span className={`severity ${issue.severity}`} /><span><span className="issue-title">{issue.title}</span><small>{issue.type.replaceAll("_", " ")} · {issue.documentTitle}</small></span>{issue.status === "resolved" && <Check size={16} />}</button>)}
          </div>}
          <div className="upload-bar"><input ref={fileInput} type="file" accept=".pdf,.csv,application/pdf,text/csv" multiple hidden onChange={(event) => handleUpload(event.target.files)} /><button onClick={() => fileInput.current?.click()}><Upload size={15} /> Add PDF or CSV source</button><button aria-label="More upload options"><MoreHorizontal size={16} /></button></div>
        </aside>

        <section className="flow-pane" aria-label="Editable workflow graph">
          <div className="flow-toolbar">
            <div className="tool-group"><button onClick={() => setModal("shadow")} className="button compact"><Plus size={15} /> Add step</button><button className="button compact"><GitCompareArrows size={15} /> Add decision</button></div>
            <div className="tool-divider" />
            <div className="tool-group"><button className="icon-button" aria-label="Undo" onClick={undo}><ArrowLeft size={16} /></button><button className="icon-button" aria-label="Redo" onClick={redo}><Redo2 size={16} /></button></div>
            <div className="flow-title"><span className="live-dot" /> Editable canonical graph</div>
            <div className="tool-group"><button className="button compact"><Keyboard size={15} /> Shortcuts</button><button className="button compact"><GripVertical size={15} /> Auto layout</button></div>
          </div>
          <div className="flow-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges.map((edge) => ({ ...edge, className: edge.animated ? "edge-loop" : "" }))}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={selectNode}
              onConnect={onConnect}
              onNodeDragStart={saveHistory}
              fitView
              minZoom={0.45}
              maxZoom={1.8}
              nodesDraggable
              nodesConnectable
              elementsSelectable
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#ccd3ce" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeColor={(node) => node.data.origin === "conflicted" ? "#b84030" : node.data.origin === "user_added" ? "#7a5aa6" : "#2f6f5e"} />
            </ReactFlow>
          </div>
          <div className="flow-legend"><span><i className="legend-shape explicit" /> Explicit</span><span><i className="legend-shape inferred" /> Inferred</span><span><i className="legend-shape user-added" /> User-added</span><span><i className="legend-shape conflicted" /> Conflict</span><span><i className="legend-shape unreviewed" /> Unreviewed</span></div>
        </section>

        <aside className="inspector-pane" aria-label="Selected workflow item properties">
          <div className="inspector-header"><div><span className="node-type">{selectedNode?.data.kind.replaceAll("_", " ")}</span><h2>{selectedNode?.data.label}</h2></div><button className="icon-button" aria-label="More item actions"><MoreHorizontal size={17} /></button></div>
          <div className="inspector-tabs"><button className="active">Properties</button><button>Evidence <span>{selectedNode?.data.evidence.length}</span></button><button>History</button></div>
          <div className="inspector-scroll">
            <section className="property-section"><h3>Review status</h3><div className="review-card"><div><OriginPill origin={selectedNode?.data.origin ?? "unknown"} /><span className="confidence"><span style={{ width: `${(selectedNode?.data.confidence ?? 0) * 100}%` }} />{Math.round((selectedNode?.data.confidence ?? 0) * 100)}% confidence</span></div><select aria-label="Review status" value={selectedNode?.data.reviewStatus} onChange={(event) => setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, reviewStatus: event.target.value as FlowNodeData["reviewStatus"] } } : node))}><option value="reviewed">Reviewed</option><option value="unreviewed">Unreviewed</option><option value="needs_attention">Needs attention</option></select></div></section>
            <section className="property-section"><h3>Details</h3><label>Step name<input value={selectedNode?.data.label ?? ""} onChange={(event) => setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, label: event.target.value } } : node))} /></label><label>Description<textarea value={selectedNode?.data.description ?? ""} rows={3} onChange={(event) => setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, description: event.target.value } } : node))} /></label><label>Responsible actor<select value={selectedNode?.data.actor} onChange={(event) => setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, actor: event.target.value } } : node))}><option>{selectedNode?.data.actor}</option><option>Permit Technician</option><option>Building Official</option><option>Fire Prevention</option><option>Planning Desk</option></select></label></section>
            {selectedId === "payment" && <section className="property-section"><div className="section-title"><h3>Deterministic fee preview</h3><span className="safe-badge"><ShieldCheck size={12} /> No model call</span></div><label>Project square footage<input type="number" min="0" value={feeInput} onChange={(event) => setFeeInput(event.target.value)} /></label><div className="fee-result"><span>Calculated plan review fee</span><strong>{feeCents === null ? "Invalid input" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(feeCents / 100)}</strong><small>max($500.00, $0.25 × square footage)</small></div></section>}
            <section className="property-section"><div className="section-title"><h3>Source evidence</h3><button onClick={() => setActiveSource(selectedEvidence?.documentTitle ?? activeSource)}>Show in source</button></div>{selectedNode?.data.evidence.map((item) => <button key={`${item.documentVersionId}-${item.textStart}`} className="evidence-card" onClick={() => setActiveSource(item.documentTitle)}><div><FileText size={15} /><strong>{item.documentTitle}</strong><span>p. {item.pageNumber}</span></div><p>“{item.text}”</p><small>{item.extractionMethod.replace("_", " ")} · source hash verified</small></button>)}</section>
            <section className="property-section"><h3>Export &amp; provenance</h3><div className="export-stack"><button onClick={exportCanonical}><Download size={15} /><span><strong>Canonical GovFlow JSON</strong><small>Schema v1.0.0 · complete provenance</small></span></button><button onClick={() => downloadText("govflow-workflow.mmd", toMermaid(nodes, edges))}><GitCompareArrows size={15} /><span><strong>Mermaid diagram</strong><small>Human-readable graph export</small></span></button><button onClick={() => downloadText("govflow-issue-report.json", JSON.stringify(issues, null, 2), "application/json")}><AlertTriangle size={15} /><span><strong>Issue report</strong><small>{openIssues.length} unresolved review items</small></span></button></div></section>
          </div>
        </aside>
      </section>

      {toast && <div className="toast" role="status"><CircleCheck size={17} /> {toast}</div>}
      {modal !== "none" && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setModal("none"); }}>
        {modal === "shadow" && <form className="modal" onSubmit={(event) => { event.preventDefault(); addShadowStep(event.currentTarget); }}><div className="modal-heading"><div><span className="modal-icon purple"><UserRound size={20} /></span><div><h2>Add a shadow-process step</h2><p>Record an undocumented operational practice without presenting it as sourced policy.</p></div></div><button type="button" onClick={() => setModal("none")} aria-label="Close"><X size={18} /></button></div><label>Author<input name="author" required defaultValue="Krishna Oza" /></label><label>Date recorded<input name="date" required type="date" defaultValue="2026-07-22" /></label><label>Description<textarea name="description" required rows={3} placeholder="e.g. Zoning desk check before payment" /></label><div className="field-row"><label>Duration<select name="duration"><option>Permanent</option><option>Temporary</option></select></label><label>Policy reference (optional)<input name="reference" placeholder="Memo, email, or ticket" /></label></div><div className="notice purple"><Info size={16} />This step will be labeled <strong>user added</strong> and included in the audit trail.</div><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setModal("none")}>Cancel</button><button className="button primary" type="submit">Add step</button></div></form>}
        {modal === "conflict" && <form className="modal" onSubmit={(event) => { event.preventDefault(); resolveConflict(event.currentTarget); }}><div className="modal-heading"><div><span className="modal-icon red"><AlertTriangle size={20} /></span><div><h2>Resolve fee conflict</h2><p>Select the controlling source. This suggestion is a review aid, not a legal conclusion.</p></div></div><button type="button" onClick={() => setModal("none")} aria-label="Close"><X size={18} /></button></div><label className="radio-card recommended"><input type="radio" name="fee" value="500.00" defaultChecked /><span><strong>FY2025 Development Fees — $500.00</strong><small>Effective Jan 1, 2025 · formally adopted schedule</small></span><span className="recommendation">Suggested</span></label><label className="radio-card"><input type="radio" name="fee" value="450.00" /><span><strong>Permit Application Instructions — $450.00</strong><small>No visible effective date · application form</small></span></label><label>Resolution reason<textarea name="reason" required rows={3} placeholder="Explain why this source controls…" defaultValue="The adopted FY2025 fee schedule is current and has a stated effective date." /></label><div className="notice"><ShieldCheck size={16} />The selected source, reviewer, timestamp, and explanation will be recorded immutably.</div><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setModal("none")}>Cancel</button><button className="button primary" type="submit">Resolve conflict</button></div></form>}
        {modal === "publish" && <div className="modal compact-modal"><div className="modal-heading"><div><span className="modal-icon red"><AlertTriangle size={20} /></span><div><h2>Publication blocked</h2><p>The deterministic publication gate found unresolved critical items.</p></div></div><button onClick={() => setModal("none")} aria-label="Close"><X size={18} /></button></div><div className="blocking-list">{validation.blocking.map((issue) => <button key={issue.id} onClick={() => { setModal("none"); setLeftTab("issues"); if (issue.nodeId) setSelectedId(issue.nodeId); }}><span className={`severity ${issue.severity}`} /><span><strong>{issue.title}</strong><small>{issue.severity} · requires reviewer decision</small></span></button>)}{validation.errors.map((error) => <div key={error}><span className="severity fatal" /><span><strong>{error}</strong><small>Graph validation error</small></span></div>)}</div><div className="modal-actions"><button className="button primary" onClick={() => { setModal("none"); setLeftTab("issues"); }}>Open review queue</button></div></div>}
      </div>}
    </main>
  );
}

export function GovFlowWorkspace() {
  return <ReactFlowProvider><Workspace /></ReactFlowProvider>;
}
