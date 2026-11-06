import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Mail,
  Loader2,
  Plus,
  Send,
  Settings,
  ClipboardList,
  BarChart3,
  Users,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { DEFAULT_EXIT_FORM, type ExitFormSchema } from '@/lib/exitFormSchema'
import {
  computeExitInviteMetrics,
  buildClosedAnswerDistribution,
  buildScaleAverages,
  buildMonthlyEvolution,
  type ExitAttemptLite,
  type ExitInviteLite,
} from '@/lib/exitInterviewLogic'
import { useToast } from '@/hooks/use-toast'

type Tab = 'convites' | 'respostas' | 'dashboard'

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'Respondido') return 'default'
  if (s === 'Enviado') return 'secondary'
  if (s === 'Falha no envio' || s === 'Expirado') return 'destructive'
  return 'outline'
}

export const ExitInterview: React.FC = () => {
  const { user, canManageExitInvites, canViewExitIndividualAnswers } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('convites')

  // ----- dados -----
  const [invites, setInvites] = useState<ExitInviteLite[]>([])
  const [attempts, setAttempts] = useState<Record<string, ExitAttemptLite[]>>({})
  const [answersByInvite, setAnswersByInvite] = useState<Record<string, any[]>>({})
  const [formVersion, setFormVersion] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invList, attList, fvList] = await Promise.all([
        pb
          .collection('exit_invites')
          .getList(1, 200, { sort: '-created', expand: 'collaborator,form_version' }),
        pb.collection('exit_send_attempts').getList(1, 500, { sort: '-created' }),
        pb.collection('exit_form_versions').getList(1, 10, { sort: '-version' }),
      ])
      setInvites(invList.items as unknown as ExitInviteLite[])
      const attMap: Record<string, ExitAttemptLite[]> = {}
      for (const a of attList.items as any[]) {
        const key = (a.invite as string) || a.invite_id
        if (!attMap[key]) attMap[key] = []
        attMap[key].push(a as ExitAttemptLite)
      }
      setAttempts(attMap)
      setFormVersion(fvList.items[0] || null)
    } catch {
      setInvites([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ----- envio de convite -----
  const [sending, setSending] = useState(false)
  const [sendInviteId, setSendInviteId] = useState<string | null>(null)
  const [sendChannels, setSendChannels] = useState<{ email: boolean; whatsapp: boolean }>({
    email: true,
    whatsapp: false,
  })
  const [sendEmail, setSendEmail] = useState('')
  const [sendPhone, setSendPhone] = useState('')

  const openSendDialog = async (inviteId: string) => {
    setSendInviteId(inviteId)
    const inv = invites.find((i) => i.id === inviteId)
    const collab: any = inv?.expand?.collaborator
    setSendEmail(collab?.contact_email || collab?.email || '')
    setSendPhone(collab?.contact_phone || '')
    setSendChannels({ email: true, whatsapp: false })
  }

  const sendInvite = async () => {
    if (!sendInviteId) return
    setSending(true)
    try {
      const channels = [
        ...(sendChannels.email ? ['email'] : []),
        ...(sendChannels.whatsapp ? ['whatsapp'] : []),
      ]
      const res = await fetch('/backend/v1/exit-invites/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          invite: sendInviteId,
          channels,
          email: sendEmail,
          phone: sendPhone,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha no envio')
      const failedChannels = (json.results || []).filter((r: any) => r.status !== 'Sucesso')
      toast({
        title: json.all_ok ? 'Convite enviado' : 'Enviado com ressalvas',
        description: json.all_ok
          ? 'Histórico registrado por canal.'
          : failedChannels.map((f: any) => `${f.channel}: ${f.error}`).join(' | '),
        variant: json.all_ok ? 'default' : 'destructive',
      })
      setSendInviteId(null)
      await load()
    } catch (err: any) {
      toast({ title: 'Erro no envio', description: err.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  // ----- criação de convite -----
  const [creating, setCreating] = useState(false)
  const [newCollabId, setNewCollabId] = useState('')
  const [newOffboarding, setNewOffboarding] = useState('')
  const [newExpires, setNewExpires] = useState('')
  const [collaborators, setCollaborators] = useState<any[]>([])

  useEffect(() => {
    if (!creating) return
    pb.collection('collaborators')
      .getList(1, 300, { sort: 'name' })
      .then((l) => setCollaborators(l.items as any[]))
      .catch(() => setCollaborators([]))
  }, [creating])

  const createInvite = async () => {
    if (!newCollabId) {
      toast({ title: 'Selecione um colaborador', variant: 'destructive' })
      return
    }
    if (!formVersion) {
      toast({
        title: 'Formulário não publicado',
        description: 'Peça ao administrador para publicar o formulário.',
        variant: 'destructive',
      })
      return
    }
    setCreating(false)
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const rec = await pb.collection('exit_invites').create({
        collaborator: newCollabId,
        form_version: formVersion.id,
        token,
        status: 'Aguardando envio',
        offboarding_date: newOffboarding || undefined,
        expires_at: newExpires || undefined,
        client: user?.client,
      })
      toast({ title: 'Convite criado', description: 'Agora envie o link para o colaborador.' })
      await load()
      await openSendDialog(rec.id)
    } catch (err: any) {
      toast({ title: 'Erro ao criar convite', description: err.message, variant: 'destructive' })
    }
  }

  // ----- dashboard -----
  const pairs = useMemo(
    () => invites.map((inv) => ({ invite: inv, attempts: attempts[inv.id] || [] })),
    [invites, attempts],
  )
  const metrics = useMemo(() => computeExitInviteMetrics(pairs), [pairs])
  const evolution = useMemo(() => buildMonthlyEvolution(pairs), [pairs])

  const [formSchema, setFormSchema] = useState<ExitFormSchema | null>(null)
  useEffect(() => {
    if (formVersion?.schema) {
      try {
        setFormSchema(JSON.parse(formVersion.schema))
      } catch {
        setFormSchema(null)
      }
    }
  }, [formVersion])

  const allAnswers = useMemo(() => Object.values(answersByInvite).flat(), [answersByInvite])

  useEffect(() => {
    if (tab !== 'respostas' && tab !== 'dashboard') return
    let alive = true
    Promise.all(
      invites.map(async (inv) => {
        const l = await pb.collection('exit_answers').getList(1, 300, {
          filter: pb.filter('invite = {:i}', { i: inv.id }),
        })
        return [inv.id, l.items] as [string, any[]]
      }),
    )
      .then((entries) => {
        if (alive) setAnswersByInvite(Object.fromEntries(entries))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tab, invites])

  const closedDist = useMemo(
    () =>
      formSchema
        ? buildClosedAnswerDistribution(
            formSchema.sections.flatMap((s) =>
              s.questions.map((q) => ({ ...q, type: q.type as string })),
            ),
            allAnswers,
          )
        : new Map(),
    [formSchema, allAnswers],
  )
  const scaleAvgs = useMemo(
    () =>
      formSchema
        ? buildScaleAverages(
            formSchema.sections.flatMap((s) =>
              s.questions.map((q) => ({ ...q, type: q.type as string })),
            ),
            allAnswers,
          )
        : new Map(),
    [formSchema, allAnswers],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando entrevistas…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Entrevista de Desligamento</h1>
        <p className="text-sm text-muted-foreground">
          Envie convites, acompanhe respostas e acompanhe o painel de resultados.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {(
          [
            ['convites', 'Convites', ClipboardList],
            ['respostas', 'Respostas', Users],
            ['dashboard', 'Dashboard', BarChart3],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ---------------- ABA CONVITES ---------------- */}
      {tab === 'convites' && (
        <div className="space-y-4">
          {canManageExitInvites ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" /> Novo convite
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <select
                  className="rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={newCollabId}
                  onChange={(e) => setNewCollabId(e.target.value)}
                >
                  <option value="">Selecione o colaborador…</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={newOffboarding}
                  onChange={(e) => setNewOffboarding(e.target.value)}
                  placeholder="Desligamento"
                />
                <Input
                  type="date"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  placeholder="Validade"
                />
                <Button onClick={createInvite}>
                  <Plus className="mr-2 h-4 w-4" /> Criar convite
                </Button>
                <p className="text-xs text-muted-foreground md:col-span-4">
                  Formulário da versão atual:{' '}
                  <strong>{formVersion?.title || 'não publicado'}</strong>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" /> Você pode consultar os convites, mas não
                enviá-los.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Convites</CardTitle>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum convite ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Colaborador</th>
                        <th className="px-2 py-2 font-medium">Desligamento</th>
                        <th className="px-2 py-2 font-medium">Validade</th>
                        <th className="px-2 py-2 font-medium">Situação</th>
                        <th className="px-2 py-2 font-medium">Tentativas</th>
                        <th className="px-2 py-2 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => {
                        const collab: any = inv.expand?.collaborator
                        const atts = attempts[inv.id] || []
                        return (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="px-2 py-2.5 font-medium">{collab?.name || '—'}</td>
                            <td className="px-2 py-2.5">
                              {inv.offboarding_date?.slice(0, 10) || '—'}
                            </td>
                            <td className="px-2 py-2.5">{inv.expires_at?.slice(0, 10) || '—'}</td>
                            <td className="px-2 py-2.5">
                              <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                            </td>
                            <td className="px-2 py-2.5 text-xs text-muted-foreground">
                              {atts.length === 0
                                ? '—'
                                : atts
                                    .map((a) => `${a.channel} → ${a.recipient} (${a.status})`)
                                    .join(' • ')}
                            </td>
                            <td className="px-2 py-2.5">
                              {canManageExitInvites && inv.status !== 'Respondido' ? (
                                <Button size="sm" onClick={() => openSendDialog(inv.id)}>
                                  <Send className="mr-1 h-3.5 w-3.5" /> Enviar
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------------- ABA RESPOSTAS ---------------- */}
      {tab === 'respostas' && (
        <div className="space-y-4">
          {!canViewExitIndividualAnswers ? (
            <Card>
              <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" /> Você não tem permissão para consultar respostas
                individuais.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {invites
                .filter((i) => i.status === 'Respondido')
                .map((inv) => {
                  const collab: any = inv.expand?.collaborator
                  const invAnswers = answersByInvite[inv.id] || []
                  return (
                    <Card key={inv.id}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {collab?.name || inv.collaborator}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Concluída em {inv.responded_at?.slice(0, 10) || '—'} • formulário v
                          {inv.expand?.form_version?.version ?? ''}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {formSchema ? (
                          formSchema.sections.map((sec) => (
                            <div key={sec.id} className="space-y-2">
                              <p className="text-sm font-semibold">{sec.title}</p>
                              {sec.questions.map((q) => {
                                const raw =
                                  invAnswers.find((a) => a.question_id === q.id)?.value || ''
                                let shown: string = raw
                                try {
                                  const parsed = raw ? JSON.parse(raw) : null
                                  shown = Array.isArray(parsed)
                                    ? parsed.join(', ')
                                    : parsed !== null
                                      ? String(parsed)
                                      : ''
                                } catch {
                                  shown = String(raw)
                                }
                                if (!shown) return null
                                return (
                                  <div key={q.id} className="text-sm">
                                    <span className="text-muted-foreground">{q.label}: </span>
                                    <strong>{shown}</strong>
                                  </div>
                                )
                              })}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Formulário da versão não disponível.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              {invites.filter((i) => i.status === 'Respondido').length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma entrevista respondida ainda.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ---------------- ABA DASHBOARD ---------------- */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            {[
              ['Convites enviados', metrics.sent],
              ['Respondidas', metrics.responded],
              ['Pendentes', metrics.pending],
              ['Expirados', metrics.expired],
              ['Taxa de resposta', `${Math.round(metrics.responseRate * 100)}%`],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-3xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução mensal</CardTitle>
            </CardHeader>
            <CardContent>
              {evolution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Mês</th>
                      <th className="py-2 font-medium">Envios</th>
                      <th className="py-2 font-medium">Respostas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolution.map((m) => (
                      <tr key={m.month} className="border-b last:border-0">
                        <td className="py-2">{m.month}</td>
                        <td className="py-2">{m.sent}</td>
                        <td className="py-2">{m.responded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição das respostas fechadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {closedDist.size === 0 ? (
                <p className="text-sm text-muted-foreground">Sem respostas fechadas ainda.</p>
              ) : (
                Array.from(closedDist.entries()).map(([qid, counts]) => {
                  const q = formSchema?.sections
                    .flatMap((s) => s.questions)
                    .find((x) => x.id === qid)
                  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
                  return (
                    <div key={qid} className="space-y-1">
                      <p className="text-sm font-medium">{q?.label || qid}</p>
                      {Array.from(counts.entries()).map(([opt, n]) => (
                        <div key={opt} className="flex items-center gap-2 text-sm">
                          <span className="w-48 shrink-0 truncate text-muted-foreground">
                            {opt}
                          </span>
                          <div className="h-2 flex-1 rounded bg-muted">
                            <div
                              className="h-2 rounded bg-primary"
                              style={{ width: `${(n / total) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right">{n}</span>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
              {scaleAvgs.size > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Médias das escalas</p>
                  {Array.from(scaleAvgs.entries()).map(([qid, v]) => {
                    const q = formSchema?.sections
                      .flatMap((s) => s.questions)
                      .find((x) => x.id === qid)
                    return (
                      <p key={qid} className="text-sm text-muted-foreground">
                        {q?.label || qid}: <strong>{v.avg.toFixed(1)}</strong> ({v.count} respostas)
                      </p>
                    )
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------------- Diálogo de envio ---------------- */}
      {sendInviteId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSendInviteId(null)}
        >
          <div
            className="mx-4 w-full max-w-md space-y-4 rounded-lg bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Enviar entrevista</h3>
            <p className="text-sm text-muted-foreground">Escolha os canais e revise os destinos.</p>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendChannels.email}
                  onChange={(e) => setSendChannels((c) => ({ ...c, email: e.target.checked }))}
                />
                E-mail
              </label>
              <Input
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendChannels.whatsapp}
                  onChange={(e) => setSendChannels((c) => ({ ...c, whatsapp: e.target.checked }))}
                />
                WhatsApp
              </label>
              <Input
                value={sendPhone}
                onChange={(e) => setSendPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
              <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                O canal WhatsApp ainda não está configurado no sistema. Ao selecioná-lo, o envio por
                ele será registrado como falha com o motivo da indisponibilidade — o e-mail continua
                funcionando.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSendInviteId(null)}>
                Cancelar
              </Button>
              <Button
                onClick={sendInvite}
                disabled={sending || (!sendChannels.email && !sendChannels.whatsapp)}
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ExitInterview
