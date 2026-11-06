/**
 * Formulários do módulo "Avaliação de Desempenho" (schema JSON versionado).
 * Seções e perguntas reproduzidas dos modelos Google Forms de referência do usuário.
 */

export type PerfQuestionType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale' | 'grid_linear'

export interface PerfQuestion {
  id: string
  type: PerfQuestionType
  label: string
  required: boolean
  options?: string[]
  rows?: string[]
  columns?: string[]
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMaxLabel?: string
  /** Mostrar apenas quando a pergunta-pai tiver uma das respostas indicadas */
  showIf?: { question: string; values: string[] }
}

export interface PerfSection {
  id: string
  title: string
  description?: string
  questions: PerfQuestion[]
}

export interface PerfFormSchema {
  title: string
  description?: string
  sections: PerfSection[]
}

const NIVEL_I: PerfFormSchema = {
  title: 'Avaliação de Desempenho — Nível I',
  description:
    'Formulário de avaliação de desempenho para colaboradores de nível I. Responda com atenção — as respostas fazem parte do histórico do colaborador.',
  sections: [
    {
      id: 's1',
      title: 'Identificação',
      description: 'Informações gerais sobre o período avaliado.',
      questions: [
        {
          id: 'q_periodo',
          type: 'text',
          label: 'Período avaliado (ex.: 1º semestre de 2026)',
          required: true,
        },
        {
          id: 'q_funcao',
          type: 'text',
          label: 'Função / cargo exercida no período',
          required: true,
        },
      ],
    },
    {
      id: 's2',
      title: 'Critérios de desempenho',
      description: 'Atribua uma nota de 1 (insatisfatório) a 5 (excelente) para cada critério.',
      questions: [
        {
          id: 'q_produtividade',
          type: 'scale',
          label: 'Produtividade e qualidade das entregas',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_disciplina',
          type: 'scale',
          label: 'Disciplina e cumprimento de prazos',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_trabalho_equipe',
          type: 'scale',
          label: 'Trabalho em equipe e comunicação',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_iniciativa',
          type: 'scale',
          label: 'Iniciativa e proatividade',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_seguranca',
          type: 'scale',
          label: 'Aderência às normas de segurança',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
      ],
    },
    {
      id: 's3',
      title: 'Pontos de atenção',
      questions: [
        {
          id: 'q_pontos_fortes',
          type: 'textarea',
          label: 'Pontos fortes observados no período',
          required: true,
        },
        {
          id: 'q_pontos_melhoria',
          type: 'textarea',
          label: 'Pontos a desenvolver no próximo ciclo',
          required: false,
        },
        {
          id: 'q_capacitacao',
          type: 'checkbox',
          label: 'Capacitações recomendadas',
          required: false,
          options: [
            'Treinamento técnico da função',
            'Segurança do trabalho',
            'Liderança e gestão de pessoas',
            'Informática / sistemas internos',
            'Outra (especificar)',
          ],
        },
        {
          id: 'q_capacitacao_outra',
          type: 'text',
          label: 'Especifique a capacitação recomendada',
          required: false,
          showIf: { question: 'q_capacitacao', values: ['Outra (especificar)'] },
        },
      ],
    },
  ],
}

const NIVEL_II: PerfFormSchema = {
  title: 'Avaliação de Desempenho — Nível II',
  description:
    'Formulário de avaliação de desempenho para colaboradores de nível II (líderes e supervisores). Responda com atenção — as respostas fazem parte do histórico do colaborador.',
  sections: [
    {
      id: 's1',
      title: 'Identificação',
      description: 'Informações gerais sobre o período avaliado.',
      questions: [
        {
          id: 'q_periodo',
          type: 'text',
          label: 'Período avaliado (ex.: 1º semestre de 2026)',
          required: true,
        },
        {
          id: 'q_funcao',
          type: 'text',
          label: 'Função / cargo exercida no período',
          required: true,
        },
      ],
    },
    {
      id: 's2',
      title: 'Resultados e gestão',
      description: 'Atribua uma nota de 1 (insatisfatório) a 5 (excelente).',
      questions: [
        {
          id: 'q_resultados',
          type: 'scale',
          label: 'Alcance das metas e resultados',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_gestao_equipe',
          type: 'scale',
          label: 'Gestão e desenvolvimento da equipe',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_planejamento',
          type: 'scale',
          label: 'Planejamento e organização do trabalho',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
      ],
    },
    {
      id: 's3',
      title: 'Comportamento e liderança',
      questions: [
        {
          id: 'q_comunicacao',
          type: 'scale',
          label: 'Comunicação e relacionamento interpessoal',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_etica',
          type: 'scale',
          label: 'Ética e postura profissional',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Insatisfatório',
          scaleMaxLabel: 'Excelente',
        },
      ],
    },
    {
      id: 's4',
      title: 'Comentários',
      questions: [
        {
          id: 'q_pontos_fortes',
          type: 'textarea',
          label: 'Pontos fortes observados no período',
          required: true,
        },
        {
          id: 'q_pontos_melhoria',
          type: 'textarea',
          label: 'Pontos a desenvolver no próximo ciclo',
          required: false,
        },
        {
          id: 'q_promocao',
          type: 'radio',
          label: 'Recomenda promoção ou nova atribuição?',
          required: true,
          options: ['Sim', 'Não', 'Talvez, com desenvolvimento'],
        },
        {
          id: 'q_observacoes',
          type: 'textarea',
          label: 'Observações finais do avaliador',
          required: false,
        },
      ],
    },
  ],
}

export const PERF_FORMS: { key: 'NIVEL_I' | 'NIVEL_II'; schema: PerfFormSchema }[] = [
  { key: 'NIVEL_I', schema: NIVEL_I },
  { key: 'NIVEL_II', schema: NIVEL_II },
]

export const PERF_FORM_STATUS_PENDENTE = 'Pendente'
