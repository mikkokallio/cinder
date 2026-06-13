import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import FileTree from './FileTree';
import { api } from '../lib/api';

interface CodeEditorProps {
  token: string;
  projectId: string;
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', json: 'json', md: 'markdown', css: 'css', html: 'html',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'shell', bash: 'shell',
    sql: 'sql', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
    bicep: 'bicep', tf: 'hcl', svelte: 'html', vue: 'html',
  };
  return map[ext] || 'plaintext';
}

export default function CodeEditor({ token, projectId }: CodeEditorProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const { content: fileContent } = await api.files.read(token, projectId, path);
      setSelectedFile(path);
      setContent(fileContent);
      setDirty(false);
    } catch (e: any) {
      if (e.message?.includes('415')) {
        // Binary file
        setSelectedFile(path);
        setContent('// Binary file -- cannot display');
        setDirty(false);
      }
    }
    setLoading(false);
  }, [token, projectId]);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !dirty) return;
    setSaving(true);
    try {
      await api.files.write(token, projectId, selectedFile, content);
      setDirty(false);
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  }, [token, projectId, selectedFile, content, dirty]);

  return (
    <div className="flex h-full">
      {/* File tree sidebar */}
      <div className="w-56 border-r border-coal-50 bg-coal-300/30 flex-shrink-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-coal-50">
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Files</span>
        </div>
        <FileTree
          token={token}
          projectId={projectId}
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
        />
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            {/* File tab bar */}
            <div className="flex items-center px-3 py-1.5 border-b border-coal-50 bg-coal-300/30">
              <span className="text-xs text-stone-300 font-mono truncate">{selectedFile}</span>
              {dirty && <span className="ml-2 w-2 h-2 rounded-full bg-ember-500" title="Unsaved" />}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="ml-auto text-xs px-2 py-1 text-stone-400 hover:text-ember-400 border border-coal-50 rounded disabled:opacity-30 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {/* Monaco */}
            <div className="flex-1">
              <Editor
                theme="vs-dark"
                language={getLanguage(selectedFile)}
                value={content}
                onChange={(val) => { setContent(val || ''); setDirty(true); }}
                loading={<div className="flex items-center justify-center h-full text-stone-500 text-sm">Loading editor...</div>}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  renderWhitespace: 'selection',
                  padding: { top: 8 },
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-stone-500 text-sm">
            Select a file from the tree
          </div>
        )}
      </div>
    </div>
  );
}
