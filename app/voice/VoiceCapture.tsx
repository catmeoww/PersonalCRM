'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { appendNoteAction } from '@/lib/actions/contacts';

type Candidate = { contactId: number; displayName: string; matchedOn: string; score: number };

type Stage = 'idle' | 'listening' | 'matching' | 'choose' | 'saved' | 'error';

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export function VoiceCapture() {
  const [stage, setStage] = useState<Stage>('idle');
  const [transcript, setTranscript] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recogRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i]?.[0];
        if (alt) text += alt.transcript;
      }
      setTranscript(text);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(e.error || 'speech-error');
      setStage('error');
    };
    rec.onend = () => {
      setStage((s) => (s === 'listening' ? 'matching' : s));
    };
    recogRef.current = rec;
    return () => {
      rec.abort();
    };
  }, []);

  async function runMatch(text: string) {
    if (!text.trim()) {
      setStage('idle');
      return;
    }
    try {
      const res = await fetch('/api/voice/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { candidates: Candidate[] };
      setCandidates(data.candidates);
      setStage('choose');
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  }

  useEffect(() => {
    if (stage === 'matching') void runMatch(transcript);
  }, [stage, transcript]);

  function start() {
    setTranscript('');
    setCandidates([]);
    setSavedFor(null);
    setError(null);
    setStage('listening');
    recogRef.current?.start();
  }

  function stop() {
    recogRef.current?.stop();
  }

  async function confirm(c: Candidate) {
    const fd = new FormData();
    fd.set('contactId', String(c.contactId));
    fd.set('body', transcript);
    fd.set('source', 'voice');
    await appendNoteAction(fd);
    setSavedFor(c.displayName);
    setStage('saved');
  }

  if (!supported) {
    return (
      <div className="card">
        <p className="font-medium">Voice input not supported on this browser.</p>
        <p className="mt-2 text-sm text-slate-600">
          Try Chrome on Android or Safari on iOS 16+. You can still type a note directly on a contact&apos;s page.
        </p>
        <textarea
          className="input mt-3"
          rows={3}
          placeholder="Type what you heard here, we&apos;ll match."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <button className="btn-primary mt-2" onClick={() => setStage('matching')}>
          Find contact
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col items-center gap-4 py-8">
        <button
          onClick={stage === 'listening' ? stop : start}
          className={clsx(
            'h-28 w-28 rounded-full text-4xl text-white transition-transform',
            stage === 'listening' ? 'bg-red-600 animate-pulse' : 'bg-brand-600',
          )}
          aria-label={stage === 'listening' ? 'Stop recording' : 'Start recording'}
        >
          🎙️
        </button>
        <p className="text-sm text-slate-500">
          {stage === 'idle' && 'Tap to speak'}
          {stage === 'listening' && 'Listening… tap to stop'}
          {stage === 'matching' && 'Finding contacts…'}
          {stage === 'choose' && 'Pick the right contact'}
          {stage === 'saved' && `Saved to ${savedFor}`}
          {stage === 'error' && `Error: ${error}`}
        </p>
      </div>

      {transcript && stage !== 'listening' && (
        <div className="card space-y-2">
          <label className="label">Transcript (editable)</label>
          <textarea
            className="input"
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          {stage === 'choose' && (
            <button className="btn-secondary" onClick={() => setStage('matching')}>
              Re-match with edited text
            </button>
          )}
        </div>
      )}

      {stage === 'choose' && (
        <div className="space-y-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-500">No matches. Edit the transcript or try again.</p>
          ) : (
            candidates.map((c) => (
              <button
                key={c.contactId}
                onClick={() => confirm(c)}
                className="card block w-full text-left hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.displayName}</span>
                  <span className="text-xs text-slate-500">{c.matchedOn}</span>
                </div>
                <p className="text-xs text-slate-500">score {c.score}</p>
              </button>
            ))
          )}
        </div>
      )}

      {stage === 'saved' && (
        <button className="btn-primary w-full" onClick={start}>
          Another note
        </button>
      )}
    </div>
  );
}
