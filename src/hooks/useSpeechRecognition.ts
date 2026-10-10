import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language } from '../types'

/**
 * Thin wrapper around the browser Web Speech API (SpeechRecognition).
 *
 * - Works fully offline-capable in Chromium/Edge/Safari (uses the OS/engine).
 * - Gracefully reports `supported: false` where the API is missing (e.g. Firefox).
 * - Emits interim + final transcripts so the input box updates live while speaking.
 */

// The Web Speech API isn't in the standard TS DOM lib, so we type it loosely.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { transcript: string; confidence: number }
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    [index: number]: SpeechRecognitionResultLike
  }
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string
  readonly message?: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Map the app language to a BCP-47 locale for the recognizer.
const LOCALE: Record<Language, string> = {
  en: 'en-PK',
  ur: 'ur-PK',
  roman: 'ur-PK', // Roman Urdu is spoken Urdu; ur-PK gives best audio recognition
}

export interface UseSpeechRecognition {
  supported: boolean
  listening: boolean
  transcript: string
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

export function useSpeechRecognition(language: Language = 'en'): UseSpeechRecognition {
  const ctor = useRef<SpeechRecognitionCtor | null>(getRecognitionCtor())
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const [supported] = useState<boolean>(() => getRecognitionCtor() != null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* no-op */
    }
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  const start = useCallback(() => {
    const Ctor = ctor.current
    if (!Ctor) {
      setError('unsupported')
      return
    }
    // Abort any previous instance before starting fresh.
    try {
      recognitionRef.current?.abort()
    } catch {
      /* no-op */
    }

    const rec = new Ctor()
    rec.lang = LOCALE[language] ?? 'en-PK'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => {
      setError(null)
      setListening(true)
    }

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const chunk = res[0]?.transcript ?? ''
        if (res.isFinal) finalText += chunk
        else interimText += chunk
      }
      if (finalText) {
        setTranscript(prev => (prev ? `${prev} ${finalText}`.trim() : finalText.trim()))
        setInterim('')
      } else {
        setInterim(interimText)
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
      setError(e.error || 'error')
      setListening(false)
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error')
      setListening(false)
    }
  }, [language])

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        /* no-op */
      }
    }
  }, [])

  return { supported, listening, transcript, interim, error, start, stop, reset }
}
