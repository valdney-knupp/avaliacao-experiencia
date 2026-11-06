/**
 * Formulário padrão da Entrevista de Desligamento (schema JSON versionado).
 * Disponível para revisão/edição antes do primeiro envio.
 */

export type ExitQuestionType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale'

export interface ExitQuestion {
  id: string
  type: ExitQuestionType
  label: string
  required: boolean
  options?: string[]
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMaxLabel?: string
}

export interface ExitSection {
  id: string
  title: string
  description?: string
  questions: ExitQuestion[]
}

export interface ExitFormSchema {
  title: string
  description?: string
  sections: ExitSection[]
}

export const DEFAULT_EXIT_FORM: ExitFormSchema = {
  title: 'Entrevista de Desligamento',
  description:
    'Sua opinião é muito importante para melhorarmos. Esta entrevista é confidencial e leva cerca de 5 minutos.',
  sections: [
    {
      id: 's1',
      title: 'Sobre o desligamento',
      questions: [
        {
          id: 'q_motivo',
          type: 'radio',
          label: 'Qual foi o principal motivo do seu desligamento?',
          required: true,
          options: [
            'Nova oportunidade de emprego',
            'Insatisfação com a função',
            'Insatisfação com a liderança',
            'Salário / benefícios',
            'Motivos pessoais',
            'Mudança de cidade',
            'Encerramento do contrato',
            'Outro (especificar)',
          ],
        },
        {
          id: 'q_motivo_outro',
          type: 'text',
          label: 'Especifique o motivo',
          required: true,
        },
      ],
    },
    {
      id: 's2',
      title: 'Sua experiência na empresa',
      questions: [
        {
          id: 'q_nota_empresa',
          type: 'scale',
          label:
            'De 0 a 10, qual a probabilidade de você recomendar a empresa como lugar para trabalhar?',
          required: true,
          scaleMin: 0,
          scaleMax: 10,
          scaleMinLabel: 'Pouco provável',
          scaleMaxLabel: 'Muito provável',
        },
        {
          id: 'q_ambiente',
          type: 'scale',
          label: 'Como você avalia o ambiente de trabalho?',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Ruim',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_lideranca',
          type: 'scale',
          label: 'Como você avalia a liderança direta?',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Ruim',
          scaleMaxLabel: 'Excelente',
        },
        {
          id: 'q_recontrataria',
          type: 'radio',
          label: 'Você voltaria a trabalhar na empresa se houvesse oportunidade?',
          required: true,
          options: ['Sim', 'Não', 'Talvez'],
        },
      ],
    },
    {
      id: 's3',
      title: 'Comentários finais',
      questions: [
        {
          id: 'q_melhorias',
          type: 'textarea',
          label: 'O que a empresa poderia melhorar?',
          required: true,
        },
        {
          id: 'q_mensagem',
          type: 'textarea',
          label: 'Mensagem final (opcional)',
          required: false,
        },
      ],
    },
  ],
}
