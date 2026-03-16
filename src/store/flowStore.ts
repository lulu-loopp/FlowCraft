import { create } from 'zustand';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';

export type GlobalLog = {
  id: string;
  timestamp: string;
  nodeName: string;
  nodeType: string;
  type: 'think' | 'act' | 'observe' | 'system';
  content: string;
};

export type RunRecord = {
  id: string;
  startedAt: string;
  status: 'success' | 'error';
  duration: number;
  nodeCount: number;
};

type FlowState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  nodeClickTick: number;
  isRunning: boolean;
  globalLogs: GlobalLog[];
  flowId: string;
  flowName: string;
  runHistory: RunRecord[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setNodesAndEdges: (nodes: Node[], edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  toggleNodeLock: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setIsRunning: (running: boolean) => void;
  setNodeStatus: (id: string, status: string) => void;
  updateNodeData: (id: string, key: string, value: any) => void;
  addLog: (log: Omit<GlobalLog, 'id' | 'timestamp'> & { nodeId?: string }) => void;
  clearLogs: () => void;
  setFlowId: (id: string) => void;
  setFlowName: (name: string) => void;
  addRunRecord: (record: RunRecord) => void;
  simulateRun: () => Promise<void>;
  simulateRunDemo: () => Promise<void>;
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  nodeClickTick: 0,
  isRunning: false,
  flowId: '',
  flowName: '',
  runHistory: [],
  globalLogs: [],
  
  onNodesChange: (changes) => {
    const currentNodes = get().nodes;
    // Filter out position changes for locked (non-draggable) nodes
    const filtered = changes.filter((change) => {
      if (change.type === 'position' && 'id' in change) {
        const node = currentNodes.find(n => n.id === change.id);
        if (node && node.draggable === false) return false;
      }
      return true;
    });
    set({ nodes: applyNodeChanges(filtered, currentNodes) });
  },
  
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  onConnect: (connection) => {
    set({
      edges: addEdge({ ...connection }, get().edges),
    });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setNodesAndEdges: (nodes, edges) => set({ nodes, edges }),
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  
  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
  },
  
  duplicateNode: (id) => {
    const nodeToCopy = get().nodes.find((n) => n.id === id);
    if (!nodeToCopy) return;
    
    const newNode = {
      ...nodeToCopy,
      id: `${nodeToCopy.type}-${Date.now()}`,
      position: { x: nodeToCopy.position.x + 50, y: nodeToCopy.position.y + 50 },
      selected: true,
    };
    
    set({
      nodes: [...get().nodes.map(n => ({...n, selected: false})), newNode],
      selectedNodeId: newNode.id,
    });
  },
  
  toggleNodeLock: (id) => {
    set({
      nodes: get().nodes.map((n) => 
        n.id === id 
          ? { ...n, draggable: n.draggable === false ? true : false } 
          : n
      )
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id, nodeClickTick: get().nodeClickTick + 1 }),
  setIsRunning: (running) => set({ isRunning: running }),

  setNodeStatus: (id, status) =>
    set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, status } } : n) }),

  updateNodeData: (id, key, value) =>
    set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n) }),
  
  addLog: (log) => {
    const newLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString()
    };
    
    set((state) => ({
      globalLogs: [...state.globalLogs, newLog],
      nodes: log.nodeId 
        ? state.nodes.map(n => n.id === log.nodeId 
            ? { ...n, data: { ...n.data, logs: [...(n.data.logs as any[] || []), newLog] } }
            : n)
        : state.nodes
    }));
  },

  clearLogs: () => set({ globalLogs: [] }),

  setFlowId: (id) => set({ flowId: id }),
  setFlowName: (name) => set({ flowName: name }),
  addRunRecord: (record) => set((state) => ({ runHistory: [record, ...state.runHistory].slice(0, 50) })),

  simulateRunDemo: async () => {
    const { nodes, setIsRunning, addLog } = get();
    if (nodes.length === 0) return;

    setIsRunning(true);
    get().clearLogs();

    set({ nodes: get().nodes.map(n => ({ ...n, data: { ...n.data, status: 'waiting', logs: [] } })) });

    for (const node of get().nodes) {
      if (!get().isRunning) break;
      set({ nodes: get().nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, status: 'running' } } : n) });
      addLog({ nodeId: node.id, nodeName: (node.data.label as string) || (node.type as string) || 'default', nodeType: node.type || 'default', type: 'system', content: 'Starting execution...' });
      await new Promise(r => setTimeout(r, 1500));
      if (node.type === 'agent') {
        const ln = (node.data.label as string) || 'Agent';
        addLog({ nodeId: node.id, nodeName: ln, nodeType: 'agent', type: 'think', content: 'Analyzing context and history...' });
        await new Promise(r => setTimeout(r, 1000));
        addLog({ nodeId: node.id, nodeName: ln, nodeType: 'agent', type: 'act', content: 'Executing mapped function call...' });
        await new Promise(r => setTimeout(r, 1500));
        addLog({ nodeId: node.id, nodeName: ln, nodeType: 'agent', type: 'observe', content: 'Process completed successfully.' });
      }
      await new Promise(r => setTimeout(r, 500));
      set({ nodes: get().nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, status: 'success' } } : n) });
    }

    setIsRunning(false);
  },

  simulateRun: async () => {
    const { nodes, setIsRunning, addLog } = get();
    if (nodes.length === 0) return;

    setIsRunning(true);
    get().clearLogs();
    
    // Reset all node statuses
    set({
      nodes: get().nodes.map(n => ({ ...n, data: { ...n.data, status: 'waiting', logs: [] } }))
    });

    // Simple sequential simulation for demo purposes
    for (const node of get().nodes) {
      if (!get().isRunning) break; // If stopped externally
      
      // Node starts running
      set({
        nodes: get().nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, status: 'running' } } : n)
      });
      
      addLog({
        nodeId: node.id,
        nodeName: (node.data.label as string) || (node.type as string) || 'default',
        nodeType: node.type || 'default',
        type: 'system',
        content: `Starting execution...`,
      });

      // Simulate work duration
      await new Promise(r => setTimeout(r, 1500));
      
      if (node.type === 'agent') {
        const ln = (node.data.label as string) || 'Agent';
        addLog({ nodeId: node.id, nodeName: ln, nodeType: 'agent', type: 'think', content: 'Analyzing context and history...' });
        await new Promise(r => setTimeout(r, 1000));
        addLog({ nodeId: node.id, nodeName: ln, nodeType: 'agent', type: 'act', content: 'Executing mapped function call...' });
        await new Promise(r => setTimeout(r, 1500));
        addLog({ nodeId: node.id, nodeName: ln, nodeType: 'agent', type: 'observe', content: 'Process completed successfully.' });
      }

      await new Promise(r => setTimeout(r, 500));

      // Node finishes
      set({
        nodes: get().nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, status: 'success' } } : n)
      });
    }

    setIsRunning(false);
  }
}));
