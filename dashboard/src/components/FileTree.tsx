import { useState, useEffect } from 'react';
import { api, FileEntry } from '../lib/api';

interface FileTreeProps {
  token: string;
  projectId: string;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

interface TreeNode extends FileEntry {
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
}

export default function FileTree({ token, projectId, onFileSelect, selectedFile }: FileTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDir('.');
  }, [projectId]);

  async function loadDir(path: string) {
    try {
      const { entries } = await api.files.list(token, projectId, path);
      const nodes: TreeNode[] = entries.map((e) => ({
        ...e,
        path: path === '.' ? e.name : `${path}/${e.name}`,
      }));
      if (path === '.') {
        setTree(nodes);
        setLoading(false);
      } else {
        setTree((prev) => updateChildren(prev, path, nodes));
      }
    } catch {
      if (path === '.') setLoading(false);
    }
  }

  function updateChildren(nodes: TreeNode[], parentPath: string, children: TreeNode[]): TreeNode[] {
    return nodes.map((node) => {
      if (node.path === parentPath) {
        return { ...node, children, expanded: true };
      }
      if (node.children) {
        return { ...node, children: updateChildren(node.children, parentPath, children) };
      }
      return node;
    });
  }

  function toggleDir(node: TreeNode) {
    if (node.expanded) {
      setTree((prev) => collapseNode(prev, node.path));
    } else {
      loadDir(node.path);
    }
  }

  function collapseNode(nodes: TreeNode[], path: string): TreeNode[] {
    return nodes.map((n) => {
      if (n.path === path) return { ...n, expanded: false };
      if (n.children) return { ...n, children: collapseNode(n.children, path) };
      return n;
    });
  }

  function renderNode(node: TreeNode, depth: number) {
    const isDir = node.type === 'dir';
    const isSelected = node.path === selectedFile;

    return (
      <div key={node.path}>
        <button
          onClick={() => isDir ? toggleDir(node) : onFileSelect(node.path)}
          className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left hover:bg-coal-50/50 rounded transition-colors ${
            isSelected ? 'bg-coal-50 text-ember-400' : 'text-stone-300'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isDir ? (
            <svg className={`w-3.5 h-3.5 text-stone-500 transition-transform ${node.expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isDir && node.expanded && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (loading) {
    return <div className="p-4 text-xs text-stone-500">Loading...</div>;
  }

  return (
    <div className="overflow-y-auto h-full py-2">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}
