import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  ClipboardList,
  Filter,
  Loader2,
  FileText,
  AlertCircle,
  Pencil,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { PERF_FORMS } from '@/lib/perfForms'
import {
  periodLabel,
  parseSchema,
  collectQuestions,
  validateRequiredAnswers,
  type PerfFormSchema,
} from '@/lib/perfEvaluationLogic'
import { useToast } from '@/hooks/use-toast'

interface PerfEvaluationRow {
  id: string
  collaborator: string
  form_version: string
  period_start?: string
  period_end?: string
  period_label?: string
  responsible?: string
  responsible_name?: string
  status: 'Rascunho' | 'Concluida'
  completed_at?: string
  created?: string
  expand?: {
    collaborator?: { name?: string }
    form_version?: { title?: string; form_key?: string; version?: number }
  }
}

const statusVariant = (s: PerfEvaluationRow['status']) =>
  s === 'Concluida' ? 'default' : 'secondary'

export const PerformanceEvaluation: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [rows, setRows] = useState<PerfEvaluationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [formFilter, setFormFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('')

  // ---------- criação de rascunho ----------
  const createDraft = useCallback(
    async (formKey: string, schema: PerfFormSchema) => {
      if (!user) return
      setStarting(true)
      try {
        // localiza ou cria a versão publicada do modelo para o tenant
        let versionRec: any = null
        try {
          versionRec = await pb
            .collection('perf_form_versions')
            .getFirstListItem(`form_key="${formKey}" && status="Publicado"`, {
              sort: '-version',
            })
        } catch {
          const base = PERF_FORMS.find((f) => f.key === formKey)
          versionRec = await pb.collection('perf_form_versions').create({
            form_key: formKey,
            version: 1,
            title: schema.title,
            subtitle: schema.description || '',
            status: 'Publicado',
            schema: JSON.stringify(schema),
            client: user.client,
          })
        }

        const rec = await pb.collection('perf_evaluations').create({
          collaborator: '',
          form_version: versionRec.id,
          period_label: '',
          responsible: user.id,
          responsible_name: user.name,
          status: 'Rascunho',
          client: user.client,
        })
        toast({
          title: 'Avaliação criada',
          description: 'Complete a identificação para continuar.',
        })
        setSearchParams({ edit: rec.id }, { replace: true })
      } catch (err: any) {
        toast({
          title: 'Erro ao iniciar avaliação',
          description: err?.message || 'Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        setStarting(false)
      }
    },
    [user, toast, setSearchParams],
  )

  // ---------- edição (rascunho retomado) ----------
  const [editing, setEditing] = useState<PerfEvaluationRow | null>(null)
  const [editingSchema, setEditingSchema] = useState<PerfFormSchema | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const openForEdit = useCallback(async (row: PerfEvaluationRow) => {
    setEditing(row)
    let schema: PerfFormSchema | null = null
    try {
      const fv: any = await pb.collection('perf_form_versions').getOne(row.form_version)
      schema = parseSchema<PerfFormSchema>(fv?.schema)
    } catch {
      schema = null
    }
    setEditingSchema(schema)
    try {
      const list = await pb.collection('perf_answers').getList(1, 200, {
        filter: pb.filter('evaluation = {:id}', { id: row.id }),
      })
      const map: Record<string, string> = {}
      for (const item of list.items as any[]) {
        map[item.question_id] = item.value
      }
      setAnswers(map)
    } catch {
      setAnswers({})
    }
  }, [])

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId && rows.length > 0 && !editing) {
      const row = rows.find((r) => r.id === editId)
      if (row && row.status === 'Rascunho') openForEdit(row)
    }
  }, [searchParams, rows, editing, openForEdit])

  const setAnswer = (qid: string, value: string) => setAnswers((m) => ({ ...m, [qid]: value }))

  const questions = useMemo(
    () => (editingSchema ? (collectQuestions(editingSchema) as any[]) : []),
    [editingSchema],
  )

  const finish = async () => {
    if (!editing) return
    const asInputs = Object.entries(answers).map(([question_id, value]) => ({ question_id, value }))
    const missing = validateRequiredAnswers(questions as any, asInputs)
    if (missing.length > 0) {
      toast({
        title: 'Campos obrigatórios pendentes',
        description: missing.slice(0, 5).join(' • '),
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      for (const [question_id, value] of Object.entries(answers)) {
        const existing = await pb.collection('perf_answers').getList(1, 1, {
          filter: pb.filter('evaluation = {:e} && question_id = {:q}', {
            e: editing.id,
            q: question_id,
          }),
        })
        if (existing.items.length > 0) {
          await pb.collection('perf_answers').update(existing.items[0].id, { value })
        } else {
          await pb.collection('perf_answers').create({
            evaluation: editing.id,
            question_id,
            value,
            client: user?.client,
          })
        }
      }
      await pb.collection('perf_evaluations').update(editing.id, {
        status: 'Concluida',
        completed_at: new Date().toISOString(),
        period_label: answers['q_periodo'] || editing.period_label || '',
      })
      toast({ title: 'Avaliação concluída', description: 'As respostas foram registradas.' })
      setEditing(null)
      setEditingSchema(null)
      setAnswers({})
      setSearchParams({}, { replace: true })
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro ao concluir',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = async () => {
    if (!editing) return
    setSaving(true)
    try {
      for (const [question_id, value] of Object.entries(answers)) {
        const existing = await pb.collection('perf_answers').getList(1, 1, {
          filter: pb.filter('evaluation = {:e} && question_id = {:q}', {
            e: editing.id,
            q: question_id,
          }),
        })
        if (existing.items.length > 0) {
          await pb.collection('perf_answers').update(existing.items[0].id, { value })
        } else {
          await pb.collection('perf_answers').create({
            evaluation: editing.id,
            question_id,
            value,
            client: user?.client,
          })
        }
      }
      await pb.collection('perf_evaluations').update(editing.id, {
        period_label: answers['q_periodo'] || editing.period_label || '',
      })
      toast({ title: 'Rascunho salvo' })
      setEditing(null)
      setEditingSchema(null)
      setAnswers({})
      setSearchParams({}, { replace: true })
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar rascunho',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // ---------- listagem ----------
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await pb.collection('perf_evaluations').getList(1, 200, {
        sort: '-created',
        expand: 'collaborator,form_version',
      })
      setRows(list.items as unknown as PerfEvaluationRow[])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('edit')) return
    load()
  }, [load, searchParams])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (formFilter !== 'all' && r.expand?.form_version?.form_key !== formFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (
          periodFilter &&
          !(r.period_label || '').toLowerCase().includes(periodFilter.toLowerCase())
        )
          return false
        return true
      }),
    [rows, formFilter, statusFilter, periodFilter],
  )

  // ---------- render ----------
  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {editingSchema?.title || 'Avaliação de Desempenho'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Pessoa avaliada:{' '}
              <strong>{editing.expand?.collaborator?.name || 'não selecionada'}</strong>
              {editing.period_label ? ` • Período: ${editing.period_label}` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setEditing(null)
              setEditingSchema(null)
              setSearchParams({}, { replace: true })
            }}
          >
            Voltar
          </Button>
        </div>

        {editingSchema ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              finish()
            }}
          >
            {editingSchema.sections.map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  {section.description ? (
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-5">
                  {section.questions.map((q: any) => {
                    const visible = isQuestionVisible(
                      q,
                      new Map(Object.entries(answers).map(([k, v]) => [k, parseAnswerValue(v)])),
                    )
                    if (!visible) return null
                    return (
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
                            {q.options.map((opt: string) => (
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
                            {q.options.map((opt: string) => {
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
                              { length: (q.scaleMax || 5) - (q.scaleMin || 1) + 1 },
                              (_, i) => (q.scaleMin || 1) + i,
                            ).map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setAnswer(q.id, String(n))}
                                className={`h-9 w-9 rounded-md border text-sm font-medium ${
                                  (answers[q.id] || '') === String(n)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                            <span className="text-xs text-muted-foreground">
                              {(q.scaleMinLabel ? `${q.scaleMinLabel} = ${q.scaleMin} · ` : '') +
                                `${q.scaleMax} = ${q.scaleMaxLabel || ''}`}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Concluir avaliação
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft} disabled={saving}>
                Salvar rascunho
              </Button>
            </div>
          </form>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" /> Formulário da versão não encontrado.
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Avaliação de Desempenho</h1>
          <p className="text-sm text-muted-foreground">
            Crie, acompanhe e consulte as avaliações de desempenho do seu cliente.
          </p>
        </div>
        <Button onClick={() => setStarting(true)} disabled={starting}>
          {starting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Nova avaliação
        </Button>
      </div>

      {/* Seleção de modelo */}
      {starting ? null : null}
      <div className="grid gap-4 md:grid-cols-2">
        {PERF_FORMS.map((f) => (
          <Card key={f.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> {f.schema.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{f.schema.description}</p>
              <p className="text-xs text-muted-foreground">
                {f.schema.sections.length} seções •{' '}
                {f.schema.sections.reduce((n, s) => n + s.questions.length, 0)} perguntas
              </p>
              <Button size="sm" onClick={() => createDraft(f.key, f.schema)} disabled={starting}>
                {starting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Iniciar com este modelo
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={formFilter} onValueChange={setFormFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os modelos</SelectItem>
              <SelectItem value="NIVEL_I">Nível I</SelectItem>
              <SelectItem value="NIVEL_II">Nível II</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="Rascunho">Rascunho</SelectItem>
              <SelectItem value="Concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Filtrar por período (ex.: 1º semestre)"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-[240px]"
          />
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma avaliação encontrada para os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Pessoa avaliada</th>
                    <th className="px-2 py-2 font-medium">Modelo</th>
                    <th className="px-2 py-2 font-medium">Período</th>
                    <th className="px-2 py-2 font-medium">Responsável</th>
                    <th className="px-2 py-2 font-medium">Situação</th>
                    <th className="px-2 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-2.5 font-medium">
                        {r.expand?.collaborator?.name || '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        {r.expand?.form_version?.title || '—'}
                        {r.expand?.form_version?.version ? (
                          <span className="text-muted-foreground">
                            {' '}
                            (v{r.expand.form_version.version})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5">{r.period_label || '—'}</td>
                      <td className="px-2 py-2.5">{r.responsible_name || '—'}</td>
                      <td className="px-2 py-2.5">
                        <Badge variant={statusVariant(r.status)}>
                          {r.status === 'Concluida' ? 'Concluída' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5">
                        {r.status === 'Rascunho' ? (
                          <Button size="sm" variant="outline" onClick={() => openForEdit(r)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Retomar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => openForEdit(r)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Consultar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PerformanceEvaluation
