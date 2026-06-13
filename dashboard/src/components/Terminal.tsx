import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  token: string;
  sessionName: string;
  shell?: 'bash' | 'copilot';
  cwd?: string;
}

export default function Terminal({ token, sessionName, shell = 'bash', cwd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0a0a0a',
        foreground: '#fafaf9',
        cursor: '#ff6b35',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(255, 107, 53, 0.3)',
        black: '#1c1917',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#fafaf9',
      },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${sessionName}?token=${encodeURIComponent(token)}&shell=${shell}${cwd ? `&cwd=${encodeURIComponent(cwd)}` : ''}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial resize
      const dims = fit.proposeDimensions();
      ws.send(JSON.stringify({ type: 'resize', cols: dims?.cols || 120, rows: dims?.rows || 30 }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') {
        term.write(msg.data);
      } else if (msg.type === 'resumed') {
        term.write(msg.replay);
      } else if (msg.type === 'exit') {
        term.write('\r\n[Session ended]\r\n');
      }
    };

    ws.onclose = () => {
      term.write('\r\n[Disconnected - will reconnect...]\r\n');
    };

    // Terminal input -> WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      const dims = fit.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [token, sessionName, shell, cwd]);

  return (
    <div
      ref={containerRef}
      className="terminal-container w-full h-full bg-coal-500"
    />
  );
}
