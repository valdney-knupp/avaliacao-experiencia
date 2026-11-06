import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertCircle, XCircle, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppLogo } from '@/components/AppLogo'
import pb from '@/lib/pocketbase/client'
import { parseAnswerValue, type ExitFormSchema, type ExitQuestion } from '@/lib/exitFormSchema'

type Phase = 'loading' | 'form' | 'already' | 'expired' | 'notfound' | 'done' | 'error'

export const ExitInterviewPublic: React.FC = () => {
  const { token = '' } = useParams()
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState('')
  const [schema, setSchema] = useState<ExitFormSchema | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    pb.send(`/backend/v1/exit-invites/answer?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    })
      .then((json: any) => {
        if (!alive) return
        setSchema(json.form)
        setPhase('form')
      })
      .catch((err: any) => {
        if (!alive) return
        const status = err?.status || err?.response?.status
        const data = err?.data || err?.response?.data || {}
        if (status === 409) {
          setMessage(data.error || 'Esta entrevista já foi respondida.')
          setPhase('already')
          return
        }
        if (status === 410) {
          setMessage(data.error || 'O prazo para responder expirou.')
          setPhase('expired')
          return
        }
        if (status === 404 || status === 400) {
          setMessage(data.error || 'Link inválido.')
          setPhase('notfound')
          return
        }
        setMessage('Não foi possível carregar a entrevista. Verifique sua conexão.')
        setPhase('error')
      })
    return () => {
      alive = false
    }
  }, [token])

  const setAnswer = (id: string, value: string) => setAnswers((m) => ({ ...m, [id]: value }))

  const submit = async () => {
    if (!schema) return
    setSubmitting(true)
    try {
      const payload = Object.entries(answers).map(([question_id, value]) => ({
        question_id,
        value,
      }))
      await pb.send('/backend/v1/exit-invites/answer', {
        method: 'POST',
        body: { token, answers: payload },
      })
      setPhase('done')
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      const data = err?.data || err?.response?.data || {}
      if (status === 409) {
        setMessage(data.error || 'Esta entrevista já foi respondida.')
        setPhase('already')
        return
      }
      if (status === 410) {
        setMessage(data.error || 'O prazo para responder expirou.')
        setPhase('expired')
        return
      }
      if (status === 422 && data.missing) {
        const labels: string[] = []
        for (const sec of schema.sections)
          for (const q of sec.questions) if (data.missing.includes(q.id)) labels.push(q.label)
        setMessage(`Perguntas obrigatórias pendentes: ${labels.slice(0, 4).join(' • ')}`)
        return
      }
      setMessage(data.error || 'Erro ao enviar. Verifique sua conexão.')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleQ = (q: ExitQuestion) => true

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
        </div>
      </div>
    )
  }

  if (phase !== 'form' && phase !== 'done') {
    const icon =
      phase === 'already' ? (
        <CheckCircle2 className="h-12 w-12 text-amber-500" />
      ) : (
        <XCircle className="h-12 w-12 text-red-500" />
      )
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            {icon}
            <p className="text-lg font-medium">{message || 'Link indisponível.'}</p>
            <p className="text-sm text-muted-foreground">
              Se precisar de ajuda, fale com o setor de Recursos Humanos da empresa.
            </p>
            <AppLogo />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-lg font-medium">Resposta registrada!</p>
            <p className="text-sm text-muted-foreground">
              Obrigado pela sua colaboração. Sua entrevista foi enviada com sucesso.
            </p>
            <AppLogo />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <AppLogo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4" /> Entrevista de Desligamento
          </div>
        </div>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {schema?.sections.map((sec) => (
            <Card key={sec.id}>
              <CardHeader>
                <CardTitle className="text-lg">{sec.title}</CardTitle>
                {sec.description ? (
                  <p className="text-sm text-muted-foreground">{sec.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-5">
                {sec.questions.filter(visibleQ).map((q) => (
                  <div key={q.id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {q.label}
                      {q.required ? <span className="text-red-500"> *</span> : null}
                    </label>
                    {q.type === 'text' ? (
                      <Input
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    ) : q.type === 'textarea' ? (
                      <textarea
                        className="min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    ) : q.type === 'radio' ? (
                      <div className="space-y-1.5">
                        {q.options?.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={q.id}
                              checked={(answers[q.id] || '') === JSON.stringify(opt)}
                              onChange={() => setAnswer(q.id, JSON.stringify(opt))}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : q.type === 'checkbox' ? (
                      <div className="space-y-1.5">
                        {q.options?.map((opt) => {
                          const cur = parseAnswerValue(answers[q.id])
                          const checked = cur.includes(opt)
                          return (
                            <label key={opt} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? cur.filter((v) => v !== opt)
                                    : [...cur, opt]
                                  setAnswer(q.id, JSON.stringify(next))
                                }}
                              />
                              {opt}
                            </label>
                          )
                        })}
                      </div>
                    ) : q.type === 'scale' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {Array.from(
                          { length: (q.scaleMax || 5) - (q.scaleMin || 0) + 1 },
                          (_, i) => (q.scaleMin || 0) + i,
                        ).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswer(q.id, String(n))}
                            className={`h-10 w-10 rounded-md border text-sm font-medium ${
                              (answers[q.id] || '') === String(n)
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          {q.scaleMinLabel} → {q.scaleMaxLabel}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end pb-6">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar respostas
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ExitInterviewPublic
