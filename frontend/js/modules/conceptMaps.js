/**
 * Feature Module 7: Concept Maps & Visual Learning
 * Interactive graph canvas allowing students to visualize relationships between academic concepts,
 * create nodes/edges, generate from materials, and save to database.
 */

window.ConceptMapsModule = {
    activeMap: null,

    async init() {
        const createForm = document.getElementById('conceptMapCreateForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateOrGenerate();
            });
        }

        await this.loadMapsList();
        await this.populateDocSelect();
    },

    async populateDocSelect() {
        const select = document.getElementById('cmap_doc_select');
        if (!select) return;

        try {
            const materials = await api('/materials');
            select.innerHTML = '<option value="">-- Or Synthesize from Document --</option>' +
                materials.map(m => `<option value="${m.id}">${escapeHtml(m.title)} (${escapeHtml(m.subject_name)})</option>`).join('');
        } catch (e) {}
    },

    async loadMapsList() {
        const container = document.getElementById('conceptMapsList');
        if (!container) return;

        try {
            const list = await api('/concept-maps');
            if (!list.length) {
                container.innerHTML = '<div class="empty-state">No saved concept maps yet. Create a new visual map above!</div>';
                return;
            }

            container.innerHTML = list.map(m => `
                <div class="card" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="eyebrow">${escapeHtml(m.subject)}</span>
                        <h3 style="font-size:16px; margin:2px 0 4px;">${escapeHtml(m.title)}</h3>
                        <p style="font-size:12px; color:var(--ink-soft);">${m.node_count} Concept Nodes · ${m.edge_count} Connections</p>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn small teal" onclick="ConceptMapsModule.openMap(${m.id})">Open Canvas</button>
                        <button class="btn small danger" onclick="ConceptMapsModule.deleteMap(${m.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load concept maps.</div>';
        }
    },

    async handleCreateOrGenerate() {
        const docSelect = document.getElementById('cmap_doc_select');
        if (docSelect && docSelect.value) {
            try {
                const res = await api('/concept-maps/generate', {
                    method: 'POST',
                    body: JSON.stringify({ material_id: docSelect.value })
                });
                alert('Concept map synthesized from document!');
                this.loadMapsList();
                this.openMap(res.id);
            } catch (err) {
                alert('Generation failed: ' + err.message);
            }
            return;
        }

        const title = document.getElementById('cmap_title').value;
        const subject = document.getElementById('cmap_subject').value;

        try {
            const res = await api('/concept-maps', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    subject,
                    nodes: [
                        { id: '1', label: title, category: 'root' },
                        { id: '2', label: 'Core Principle', category: 'core' }
                    ],
                    edges: [
                        { from: '1', to: '2', relation: 'defines' }
                    ]
                })
            });
            document.getElementById('conceptMapCreateForm').reset();
            this.loadMapsList();
            this.openMap(res.id);
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    },

    async openMap(id) {
        const canvasContainer = document.getElementById('concept_canvas_container');
        if (!canvasContainer) return;

        try {
            const map = await api(`/concept-maps/${id}`);
            this.activeMap = map;

            canvasContainer.style.display = 'block';
            canvasContainer.scrollIntoView({ behavior: 'smooth' });
            this.renderCanvas();
        } catch (err) {
            alert('Failed to open map: ' + err.message);
        }
    },

    renderCanvas() {
        const canvasContainer = document.getElementById('concept_canvas_container');
        if (!this.activeMap) return;

        const nodes = this.activeMap.nodes || [];
        const edges = this.activeMap.edges || [];

        canvasContainer.innerHTML = `
            <div class="card concept-canvas-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div>
                        <span class="eyebrow">// Visual Concept Graph</span>
                        <h2 style="font-size:18px;">${escapeHtml(this.activeMap.title)} (${escapeHtml(this.activeMap.subject)})</h2>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn small teal" onclick="ConceptMapsModule.addNodePrompt()">+ Add Node</button>
                        <button class="btn small" onclick="ConceptMapsModule.addEdgePrompt()">🔗 Connect Nodes</button>
                        <button class="btn small secondary" onclick="ConceptMapsModule.saveMap()">Save Changes</button>
                        <button class="btn small secondary" onclick="ConceptMapsModule.closeCanvas()">Close</button>
                    </div>
                </div>

                <div class="concept-board" id="conceptBoard">
                    <div class="concept-nodes-wrap">
                        ${nodes.map(n => `
                            <div class="concept-node ${n.category || 'core'}" id="node_${n.id}" data-id="${n.id}">
                                <div class="node-title">${escapeHtml(n.label)}</div>
                                <span class="node-tag">${n.category || 'concept'}</span>
                                <button class="node-del-btn" onclick="ConceptMapsModule.deleteNode('${n.id}')">×</button>
                            </div>
                        `).join('')}
                    </div>

                    <div class="concept-edges-list card" style="margin-top:16px; background:#fafbf8;">
                        <span class="eyebrow">// Relationships</span>
                        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                            ${edges.map((e, idx) => {
                                const fromNode = nodes.find(n => n.id === e.from);
                                const toNode = nodes.find(n => n.id === e.to);
                                return `
                                    <div class="edge-chip">
                                        <strong>${escapeHtml(fromNode?.label || e.from)}</strong>
                                        <span class="edge-rel">── ${escapeHtml(e.relation || 'relates to')} ──▶</span>
                                        <strong>${escapeHtml(toNode?.label || e.to)}</strong>
                                        <button class="edge-del" onclick="ConceptMapsModule.deleteEdge(${idx})">×</button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    addNodePrompt() {
        const label = prompt('Enter Concept Node Label (e.g. Asymptotic Complexity, AES Algorithm):');
        if (!label) return;
        const category = prompt('Category (root, core, detail, application):', 'core') || 'core';

        const newId = String(Date.now());
        this.activeMap.nodes.push({ id: newId, label: label.trim(), category });
        this.renderCanvas();
    },

    addEdgePrompt() {
        if (this.activeMap.nodes.length < 2) {
            return alert('You need at least 2 nodes to connect them.');
        }

        const options = this.activeMap.nodes.map((n, i) => `${i + 1}. ${n.label} (ID: ${n.id})`).join('\n');
        const fromId = prompt(`Select Source Node ID:\n\n${options}`);
        if (!fromId) return;

        const toId = prompt(`Select Target Node ID:\n\n${options}`);
        if (!toId) return;

        const relation = prompt('Relationship description (e.g. implements, optimizes, inherits from):', 'relates to') || 'relates to';

        this.activeMap.edges.push({ from: fromId.trim(), to: toId.trim(), relation: relation.trim() });
        this.renderCanvas();
    },

    deleteNode(nodeId) {
        this.activeMap.nodes = this.activeMap.nodes.filter(n => n.id !== nodeId);
        this.activeMap.edges = this.activeMap.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
        this.renderCanvas();
    },

    deleteEdge(edgeIndex) {
        this.activeMap.edges.splice(edgeIndex, 1);
        this.renderCanvas();
    },

    async saveMap() {
        try {
            await api('/concept-maps', {
                method: 'POST',
                body: JSON.stringify(this.activeMap)
            });
            alert('Concept map saved successfully!');
            this.loadMapsList();
        } catch (err) {
            alert('Failed to save map: ' + err.message);
        }
    },

    async deleteMap(id) {
        if (!confirm('Are you sure you want to delete this concept map?')) return;
        try {
            await api(`/concept-maps/${id}`, { method: 'DELETE' });
            this.loadMapsList();
            this.closeCanvas();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    },

    closeCanvas() {
        const container = document.getElementById('concept_canvas_container');
        if (container) container.style.display = 'none';
        this.activeMap = null;
    }
};
