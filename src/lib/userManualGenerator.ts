import { SimplePdfDocument } from './pdfBuilder'

/**
 * Constrói o documento completo do Manual do Usuário em PDF (multipage)
 * com formatação profissional, cores institucionais do sistema (#54D769 e #111111)
 * e todas as seções instrucionais requeridas.
 */
export function generateUserManualPdfBytes(): Uint8Array {
  const doc = new SimplePdfDocument()
  const pageW = 595.28
  const pageH = 841.89
  const marginX = 42

  // Cores institucionais
  const greenPrimary: [number, number, number] = [0.329, 0.843, 0.412] // #54D769
  const darkHeader: [number, number, number] = [0.067, 0.082, 0.07] // #111512
  const textDark: [number, number, number] = [0.1, 0.12, 0.15]
  const textMuted: [number, number, number] = [0.4, 0.45, 0.5]
  const cardBg: [number, number, number] = [0.965, 0.975, 0.97]
  const cardBorder: [number, number, number] = [0.88, 0.9, 0.89]

  // Helper para adicionar cabeçalho e rodapé em páginas de conteúdo
  const addPageHeaderAndFooter = (
    page: any,
    pageNumber: number,
    totalPages: number,
    sectionTitle: string,
  ) => {
    // Header bar
    page.rect(marginX, pageH - 42, pageW - 2 * marginX, 1, { strokeColor: [0.88, 0.9, 0.9] })
    page.text(marginX, pageH - 34, 'AVALIAÇÃO DE EXPERIÊNCIA - MANUAL DO USUÁRIO', {
      size: 7.5,
      font: 'bold',
      color: textMuted,
    })
    page.text(pageW - marginX - 180, pageH - 34, sectionTitle.toUpperCase(), {
      size: 7.5,
      font: 'oblique',
      color: textMuted,
    })

    // Footer bar
    page.rect(marginX, 42, pageW - 2 * marginX, 1, { strokeColor: [0.88, 0.9, 0.9] })
    page.text(
      marginX,
      30,
      'Confidencial e de Uso Exclusivo • Suporte: WhatsApp (82) 99106-9350 | valdknupp@gmail.com',
      {
        size: 7,
        font: 'regular',
        color: textMuted,
      },
    )
    page.text(pageW - marginX - 60, 30, `Página ${pageNumber} de ${totalPages}`, {
      size: 7.5,
      font: 'bold',
      color: textDark,
    })
  }

  // Helper para quebra de texto em linhas
  const wrapText = (text: string, maxCharsPerLine: number = 88): string[] => {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const w of words) {
      if (!currentLine) {
        currentLine = w
      } else if (currentLine.length + 1 + w.length <= maxCharsPerLine) {
        currentLine += ' ' + w
      } else {
        lines.push(currentLine)
        currentLine = w
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  // -------------------------------------------------------------
  // PÁGINA 1: CAPA INSTITUCIONAL & APRESENTAÇÃO
  // -------------------------------------------------------------
  {
    const p1 = doc.addPage()

    // Bloco superior de destaque
    p1.rect(0, pageH - 240, pageW, 240, { fillColor: darkHeader })
    p1.rect(0, pageH - 244, pageW, 4, { fillColor: greenPrimary })

    // Tag do produto
    p1.rect(marginX, pageH - 65, 175, 20, { fillColor: [0.15, 0.22, 0.17] })
    p1.text(marginX + 8, pageH - 52, 'GESTÃO PROFISSIONAL DE RH', {
      size: 8.5,
      font: 'bold',
      color: greenPrimary,
    })

    // Título Principal
    p1.text(marginX, pageH - 110, 'MANUAL DO USUÁRIO', {
      size: 26,
      font: 'bold',
      color: [1, 1, 1],
    })
    p1.text(marginX, pageH - 138, 'Sistema Integrado de Avaliação de Período de Experiência', {
      size: 13,
      font: 'regular',
      color: [0.85, 0.9, 0.88],
    })
    p1.text(marginX, pageH - 158, 'Contratos de 45 e 90 Dias • Métricas, Critérios e Prazos', {
      size: 10,
      font: 'oblique',
      color: greenPrimary,
    })

    // Sub-banner de boas-vindas
    p1.rect(marginX, pageH - 215, pageW - 2 * marginX, 36, {
      fillColor: [0.12, 0.15, 0.13],
      strokeColor: [0.25, 0.3, 0.26],
    })
    p1.text(
      marginX + 12,
      pageH - 195,
      'Guia definitivo para alcançar o melhor resultado absoluto com o sistema.',
      {
        size: 9.5,
        font: 'bold',
        color: [1, 1, 1],
      },
    )
    p1.text(
      marginX + 12,
      pageH - 208,
      'Ordens de cadastro, matriz de critérios, fluxos de prazos e importações inteligentes.',
      {
        size: 8.5,
        font: 'regular',
        color: [0.8, 0.85, 0.8],
      },
    )

    // Corpo da Apresentação
    let curY = pageH - 280
    p1.text(marginX, curY, '1. APRESENTAÇÃO E OBJETIVO DO SISTEMA', {
      size: 13,
      font: 'bold',
      color: textDark,
    })
    p1.rect(marginX, curY - 5, 260, 2, { fillColor: greenPrimary })
    curY -= 24

    const introText = [
      'O Avaliação de Experiência é uma plataforma corporativa desenvolvida para estruturar, automatizar e assegurar o cumprimento rigoroso dos ciclos de avaliação do período probatório de colaboradores (45 e 90 dias da CLT).',
      '',
      'A não realização tempestiva de uma avaliação de experiência pode acarretar a efetivação tácita de um contrato sem a devida deliberação da liderança, gerando custos de rescisão e passivos operacionais desnecessários.',
      '',
      'Com esta solução, a equipe de Gestão de Pessoas e as lideranças (obras e departamentos) contam com alertas preditivos diários, painel de engajamento em tempo real, auditoria completa e relatórios gerenciais.',
    ]

    for (const para of introText) {
      if (!para) {
        curY -= 6
        continue
      }
      const lines = wrapText(para, 86)
      for (const line of lines) {
        p1.text(marginX, curY, line, { size: 9, font: 'regular', color: textDark })
        curY -= 13
      }
    }

    curY -= 10
    // Sumário Executivo do Manual
    p1.text(marginX, curY, 'SUMÁRIO DAS ETAPAS E SEÇÕES DESTE MANUAL', {
      size: 11,
      font: 'bold',
      color: textDark,
    })
    p1.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const summaryItems = [
      ['Etapa 1', 'Ordem Correta de Cadastros (Centros de Custo -> Setores -> Critérios)'],
      ['Etapa 2', 'Herança Inteligente: Padrão de Escritório vs. Critérios Personalizados'],
      ['Etapa 3', 'Cadastro de Colaboradores e Regras de Cálculo dos Prazos de 45 e 90 Dias'],
      ['Etapa 4', 'Execução das Avaliações, Métricas de Engajamento e Indicadores'],
      ['Etapa 5', 'Importação em Lote via Planilhas .XLSX (Os 5 Slots Especializados)'],
      ['Etapa 6', 'Perfis de Acesso, Alternância de Temas (Claro/Escuro) e Suporte Técnico'],
      ['Etapa 7', 'Guia de Melhores Práticas para o Máximo Resultado Organizacional'],
    ]

    for (const [badge, desc] of summaryItems) {
      p1.rect(marginX, curY - 3, 50, 14, { fillColor: cardBg, strokeColor: cardBorder })
      p1.text(marginX + 5, curY + 2, badge, { size: 8, font: 'bold', color: textDark })
      p1.text(marginX + 58, curY + 2, '•  ' + desc, {
        size: 8.5,
        font: 'regular',
        color: textDark,
      })
      curY -= 18
    }

    // Caixa de Canais de Suporte na Capa
    p1.rect(marginX, 50, pageW - 2 * marginX, 60, {
      fillColor: [0.93, 0.98, 0.94],
      strokeColor: [0.75, 0.9, 0.78],
    })
    p1.text(marginX + 14, 94, 'CANAL OFICIAL DE SUPORTE E ATENDIMENTO', {
      size: 8.5,
      font: 'bold',
      color: [0.1, 0.5, 0.2],
    })
    p1.text(
      marginX + 14,
      80,
      'WhatsApp: (82) 99106-9350   •   E-mail: valdknupp@gmail.com   •   Horário Comercial',
      {
        size: 9,
        font: 'bold',
        color: textDark,
      },
    )
    p1.text(
      marginX + 14,
      68,
      'Acesso ao sistema: seu e-mail de compra cadastrado na Stripe é o seu login administrador inicial.',
      {
        size: 8,
        font: 'regular',
        color: textMuted,
      },
    )
  }

  // -------------------------------------------------------------
  // PÁGINA 2: A ORDEM CORRETA DE CADASTROS (PASSO A PASSO)
  // -------------------------------------------------------------
  {
    const p2 = doc.addPage()
    addPageHeaderAndFooter(p2, 2, 7, 'Ordem Correta de Cadastros')

    let curY = pageH - 65
    p2.text(marginX, curY, '2. A ORDEM CORRETA DOS CADASTROS NO SISTEMA', {
      size: 14,
      font: 'bold',
      color: textDark,
    })
    p2.rect(marginX, curY - 5, 330, 2, { fillColor: greenPrimary })
    curY -= 22

    const orderNotice = wrapText(
      'ATENÇÃO: Seguir rigorosamente a ordem sequencial descrita abaixo é o fator determinante para o sucesso da implantação. Cadastrar colaboradores antes das estruturas básicas impossibilita o vínculo correto de gestores e de critérios de avaliação.',
      88,
    )
    p2.rect(
      marginX,
      curY - (orderNotice.length * 12 + 8),
      pageW - 2 * marginX,
      orderNotice.length * 12 + 16,
      {
        fillColor: [0.99, 0.96, 0.9],
        strokeColor: [0.94, 0.78, 0.5],
      },
    )
    for (const l of orderNotice) {
      p2.text(marginX + 10, curY, l, { size: 8, font: 'bold', color: [0.65, 0.35, 0] })
      curY -= 12
    }
    curY -= 18

    // PASSO 1: Centros de Custo
    p2.rect(marginX, curY - 5, 24, 18, { fillColor: darkHeader })
    p2.text(marginX + 7, curY + 1, '1', { size: 10, font: 'bold', color: greenPrimary })
    p2.text(
      marginX + 32,
      curY + 2,
      'PASSO 1: Cadastrar os Centros de Custo (Menu Administração -> Centros de Custo)',
      {
        size: 10.5,
        font: 'bold',
        color: textDark,
      },
    )
    curY -= 18

    const p1Desc = [
      '• O que são: Representam as unidades físicas de trabalho da empresa. Dividem-se em dois tipos principais: "Obra" (canteiros de construção civil, filiais ou postos de serviço) e "Escritório" (sede administrativa, matriz).',
      '• E-mails destinatários: Cada Centro de Custo possui um campo específico para inserir os e-mails dos responsáveis que devem receber os alertas automáticos diários de vencimento de 45 e 90 dias.',
      '• Boas práticas: Cadastre todos os centros de custo ativos antes de incluir colaboradores. Utilize a nomenclatura padronizada do seu ERP financeiro para facilitar a integração.',
    ]
    for (const p of p1Desc) {
      const lines = wrapText(p, 88)
      for (const l of lines) {
        p2.text(marginX + 12, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }

    curY -= 12
    // PASSO 2: Setores
    p2.rect(marginX, curY - 5, 24, 18, { fillColor: darkHeader })
    p2.text(marginX + 7, curY + 1, '2', { size: 10, font: 'bold', color: greenPrimary })
    p2.text(
      marginX + 32,
      curY + 2,
      'PASSO 2: Cadastrar os Setores/Áreas (Menu Administração -> Setores)',
      {
        size: 10.5,
        font: 'bold',
        color: textDark,
      },
    )
    curY -= 18

    const p2Desc = [
      '• O que são: Os departamentos internos do escritório administrativo (ex.: Financeiro, Contabilidade, RH, Suprimentos, Engenharia, Jurídico, TI, Diretoria).',
      '• Vínculo: Cada setor pode ter gestores exclusivos designados (perfil Gestor de Setor) que terão visibilidade restrita aos colaboradores lotados naquela área.',
      '• Dica: Mantenha apenas setores ativos. Setores inativados permanecem no histórico sem poluir novos cadastros.',
    ]
    for (const p of p2Desc) {
      const lines = wrapText(p, 88)
      for (const l of lines) {
        p2.text(marginX + 12, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }

    curY -= 12
    // PASSO 3: Usuários e Gestores
    p2.rect(marginX, curY - 5, 24, 18, { fillColor: darkHeader })
    p2.text(marginX + 7, curY + 1, '3', { size: 10, font: 'bold', color: greenPrimary })
    p2.text(
      marginX + 32,
      curY + 2,
      'PASSO 3: Cadastrar Usuários e Lideranças (Menu Administração -> Usuários)',
      {
        size: 10.5,
        font: 'bold',
        color: textDark,
      },
    )
    curY -= 18

    const p3Desc = [
      '• Perfis disponíveis: Administrador, Gestão de Pessoas (RH), Gestor de Obra, Gestor de Setor, Assistente Administrativo e Consulta (Viewer).',
      '• Escopo: Ao criar um Gestor de Obra, vincule o Centro de Custo correspondente. Ao criar um Gestor de Setor, vincule o Setor de atuação. Assim, o sistema isola o acesso e envia os alertas corretos.',
      '• Senha temporária: O administrador define uma senha inicial segura de no mínimo 8 caracteres que pode ser redefinida a qualquer momento.',
    ]
    for (const p of p3Desc) {
      const lines = wrapText(p, 88)
      for (const l of lines) {
        p2.text(marginX + 12, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }
  }

  // -------------------------------------------------------------
  // PÁGINA 3: MATRIZ DE CRITÉRIOS & HERANÇA DO PADRÃO DE ESCRITÓRIO
  // -------------------------------------------------------------
  {
    const p3 = doc.addPage()
    addPageHeaderAndFooter(p3, 3, 7, 'Critérios por Setor e Herança')

    let curY = pageH - 65
    p3.text(marginX, curY, '3. MATRIZ DE CRITÉRIOS: OBRAS E ESCRITÓRIO', {
      size: 14,
      font: 'bold',
      color: textDark,
    })
    p3.rect(marginX, curY - 5, 330, 2, { fillColor: greenPrimary })
    curY -= 22

    const critIntro = wrapText(
      'O sistema segmenta os critérios de avaliação em duas grandes categorias operacionais: CRITÉRIOS DE OBRAS e CRITÉRIOS DE ESCRITÓRIO. Cada um atende às particularidades da função com flexibilidade total para customizações.',
      88,
    )
    for (const l of critIntro) {
      p3.text(marginX, curY, l, { size: 9, font: 'regular', color: textDark })
      curY -= 13
    }
    curY -= 10

    // Card Obras
    p3.rect(marginX, curY - 95, pageW - 2 * marginX, 95, {
      fillColor: cardBg,
      strokeColor: cardBorder,
    })
    p3.text(marginX + 12, curY - 14, 'A. CRITÉRIOS DE OBRAS (4 CRITÉRIOS PADRÃO)', {
      size: 10,
      font: 'bold',
      color: [0.1, 0.4, 0.7],
    })
    p3.text(
      marginX + 12,
      curY - 28,
      'Aplicados automaticamente a todos os colaboradores lotados em Centros de Custo do tipo "Obra":',
      {
        size: 8.5,
        font: 'regular',
        color: textDark,
      },
    )

    const obrasCrits = [
      '1. Disciplina e cumprimento de regras (Pontualidade, respeito a EPIs/segurança, conduta ética)',
      '2. Qualidade e produtividade (Rendimento, atenção aos detalhes, precisão na execução)',
      '3. Relacionamento interpessoal e trabalho em equipe (Comunicação respeitosa, colaboração mútua)',
      '4. Assiduidade (Frequência regular, ausência de faltas injustificadas)',
    ]
    let oY = curY - 42
    for (const oc of obrasCrits) {
      p3.text(marginX + 18, oY, '• ' + oc, { size: 8, font: 'regular', color: textDark })
      oY -= 12
    }
    curY -= 115

    // Card Escritório & Herança
    p3.rect(marginX, curY - 170, pageW - 2 * marginX, 170, {
      fillColor: [0.98, 0.97, 0.99],
      strokeColor: [0.88, 0.82, 0.95],
    })
    p3.text(
      marginX + 12,
      curY - 16,
      'B. CRITÉRIOS DE ESCRITÓRIO E ARQUITETURA DE HERANÇA INTELIGENTE',
      {
        size: 10,
        font: 'bold',
        color: [0.45, 0.15, 0.65],
      },
    )

    const escritorioExplanations = [
      '• O que é o Padrão de Escritório: Conjunto mestre de 8 critérios corporativos (Entrega de Resultados, Capacidade Técnica, Proatividade, Dinamismo, Solução de Problemas, Trabalho em Equipe, Postura Profissional e Assiduidade).',
      '• Herança Padrão: Todo setor recém-criado herda automaticamente o Padrão de Escritório. Não é necessário duplicar critérios manualmente para cada setor.',
      '• Personalização por Setor: Caso um departamento específico necessite de critérios exclusivos (ex.: Engenharia com foco em AutoCAD/Projetos, ou TI com foco em Chamados), acesse a aba "Critérios", clique no setor e selecione "Personalizar para este Setor".',
      '• Efeito da Personalização: O sistema cria uma cópia independente dos critérios para aquele setor. As avaliações dos colaboradores daquele setor passarão a utilizar estes novos itens.',
      '• Botão "Voltar ao Padrão": Se desejar descartar a personalização e reestabelecer o padrão corporativo, basta clicar em "Voltar ao Padrão" com um clique.',
    ]

    let eY = curY - 32
    for (const exp of escritorioExplanations) {
      const lines = wrapText(exp, 84)
      for (const l of lines) {
        p3.text(marginX + 12, eY, l, { size: 8, font: 'regular', color: textDark })
        eY -= 12
      }
      eY -= 2
    }
    curY -= 190

    // Escala de Avaliação
    p3.text(marginX, curY, 'ESCALA DE RESPOSTAS E PONTUAÇÃO (MAPEAMENTO DE SCORE)', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p3.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const scaleItems = [
      ['ÓTIMO', 'Nota 10.0', 'Supera as expectativas de forma consistente e exemplar'],
      ['BOM', 'Nota 8.0', 'Atende plenamente aos requisitos e padrões exigidos'],
      ['REGULAR', 'Nota 5.0', 'Atende parcialmente; necessita de acompanhamento ou reciclagem'],
      ['RUIM', 'Nota 2.0', 'Desempenho abaixo do aceitável; plano de ação ou desligamento'],
    ]

    for (const [grade, score, meaning] of scaleItems) {
      p3.rect(marginX, curY - 3, 55, 14, { fillColor: cardBg, strokeColor: cardBorder })
      p3.text(marginX + 6, curY + 2, grade, { size: 7.5, font: 'bold', color: textDark })
      p3.text(marginX + 65, curY + 2, score, { size: 8, font: 'bold', color: greenPrimary })
      p3.text(marginX + 115, curY + 2, '-  ' + meaning, {
        size: 8,
        font: 'regular',
        color: textMuted,
      })
      curY -= 17
    }
  }

  // -------------------------------------------------------------
  // PÁGINA 4: COLABORADORES, CICLOS DE 45 E 90 DIAS E ENGAGEMENT
  // -------------------------------------------------------------
  {
    const p4 = doc.addPage()
    addPageHeaderAndFooter(p4, 4, 7, 'Colaboradores, Prazos e Métricas')

    let curY = pageH - 65
    p4.text(marginX, curY, '4. CADASTRO DE COLABORADORES E CICLOS DE 45/90 DIAS', {
      size: 14,
      font: 'bold',
      color: textDark,
    })
    p4.rect(marginX, curY - 5, 360, 2, { fillColor: greenPrimary })
    curY -= 22

    const cIntro = [
      'O cadastro do colaborador é o coração da operação. A partir da Data de Admissão informada, o sistema calcula automaticamente os dois marcos críticos legais previstos na CLT para contratos probatórios:',
      '• 1º Período (45 dias): Vencimento calculado exatamente em (Data de Admissão + 44 dias).',
      '• 2º Período (90 dias): Vencimento calculado exatamente em (Data de Admissão + 89 dias).',
      '• Antecedência de Alerta (5 dias): O sistema sinaliza a avaliação como "No Prazo" e dispara avisos com 5 dias de antecedência para que a liderança realize a avaliação antes do vencimento.',
    ]
    for (const ci of cIntro) {
      const lines = wrapText(ci, 88)
      for (const l of lines) {
        p4.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }
    curY -= 12

    // Tabela de Situações de Prazo
    p4.text(marginX, curY, 'ESTADOS DE PRAZO DAS AVALIAÇÕES', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p4.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const situations = [
      [
        'NO PRAZO (VERDE)',
        'Avaliação dentro da janela de antecedência de 5 dias ou realizada antes do vencimento.',
      ],
      [
        'HOJE (AMARELO)',
        'O prazo limite de 45 ou 90 dias vence na data de hoje. Prioridade máxima de conclusão.',
      ],
      [
        'VENCIDA (VERMELHO)',
        'Prazo ultrapassado sem preenchimento. Alerta crítico de risco de efetivação tácita!',
      ],
      [
        'FUTURA (CINZA)',
        'Ainda fora da janela de alerta (mais de 5 dias restantes até a data-alvo).',
      ],
      ['CONCLUÍDA (VERDE ESCURO)', 'Avaliação finalizada com parecer e notas registradas.'],
    ]

    for (const [sit, desc] of situations) {
      p4.rect(marginX, curY - 4, 110, 15, { fillColor: cardBg, strokeColor: cardBorder })
      p4.text(marginX + 6, curY + 2, sit, { size: 7, font: 'bold', color: textDark })
      p4.text(marginX + 118, curY + 2, desc, { size: 8, font: 'regular', color: textDark })
      curY -= 18
    }
    curY -= 14

    // Dashboard & Métricas de Engajamento
    p4.text(marginX, curY, 'DASHBOARD E MÉTRICAS DE ENGAJAMENTO EM TEMPO REAL', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p4.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const dashDesc = [
      'O Dashboard principal do sistema oferece visibilidade instantânea para diretoria e RH:',
      '1. Card "Taxa de Engajamento Geral": Percentual de avaliações concluídas versus o total previsto.',
      '2. Card "Aderência aos Prazos": Percentual de avaliações concluídas estritamente dentro da data limite.',
      '3. Card "Pontuação Média Global": Média ponderada calculada a partir de todas as respostas (Ótimo=10, Bom=8, Regular=5, Ruim=2).',
      '4. Gráficos Comparativos por Setor e Obra: Identifica rapidamente quais áreas cumprem os prazos com rigor e quais necessitam de cobrança ativa da Gestão de Pessoas.',
      '5. Tabela de Próximos Vencimentos: Lista ordenada de colaboradores que necessitam de avaliação nos próximos dias, com acesso direto ao formulário com um clique.',
    ]
    for (const d of dashDesc) {
      const lines = wrapText(d, 88)
      for (const l of lines) {
        p4.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }
  }

  // -------------------------------------------------------------
  // PÁGINA 5: IMPORTAÇÃO POR PLANILHAS (OS 5 SLOTS & .XLSX)
  // -------------------------------------------------------------
  {
    const p5 = doc.addPage()
    addPageHeaderAndFooter(p5, 5, 7, 'Importação em Lote via Planilhas')

    let curY = pageH - 65
    p5.text(marginX, curY, '5. IMPORTAÇÃO POR PLANILHAS: OS 5 SLOTS ESPECIALIZADOS', {
      size: 14,
      font: 'bold',
      color: textDark,
    })
    p5.rect(marginX, curY - 5, 390, 2, { fillColor: greenPrimary })
    curY -= 22

    const impNotice = wrapText(
      'O módulo de Importação (Menu "Importação de dados") permite a carga massiva de colaboradores e históricos legados de avaliações através de arquivos Excel (.xlsx real ou CSV). O sistema possui 5 slots pré-configurados com modelos oficiais para download.',
      88,
    )
    for (const l of impNotice) {
      p5.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
      curY -= 12
    }
    curY -= 12

    // Tabela dos 5 Slots
    const slots = [
      {
        num: 'SLOT 1',
        title: 'Inclusão de Colaboradores',
        file: 'COLABORADORES.xlsx',
        desc: 'Cria novos colaboradores e atualiza dados cadastrais existentes. Campos: Nome, CPF, Função, Centro de Custo, Setor, Data de Admissão.',
      },
      {
        num: 'SLOT 2',
        title: 'Avaliações de Obras 45 Dias',
        file: 'OBRAS_45D.xlsx',
        desc: 'Importa respostas da avaliação de 45 dias para pessoal de obras. Valida notas dos 4 critérios de obras e parecer do gestor.',
      },
      {
        num: 'SLOT 3',
        title: 'Avaliações de Obras 90 Dias',
        file: 'OBRAS_90D.xlsx',
        desc: 'Importa avaliações finais de 90 dias para obras, incluindo recomendação de efetivação, prorrogação ou desligamento.',
      },
      {
        num: 'SLOT 4',
        title: 'Avaliações de Escritório 45 Dias',
        file: 'ESCRITORIO_45D.xlsx',
        desc: 'Importa respostas da avaliação de 45 dias para setores administrativos com base nos 8 critérios do escritório.',
      },
      {
        num: 'SLOT 5',
        title: 'Avaliações de Escritório 90 Dias',
        file: 'ESCRITORIO_90D.xlsx',
        desc: 'Importa a decisão final do período de experiência dos colaboradores de escritório.',
      },
    ]

    for (const s of slots) {
      p5.rect(marginX, curY - 34, pageW - 2 * marginX, 34, {
        fillColor: cardBg,
        strokeColor: cardBorder,
      })
      p5.rect(marginX + 6, curY - 26, 46, 16, { fillColor: darkHeader })
      p5.text(marginX + 10, curY - 15, s.num, { size: 7.5, font: 'bold', color: greenPrimary })
      p5.text(marginX + 58, curY - 14, `${s.title}  (Arquivo sugerido: ${s.file})`, {
        size: 9,
        font: 'bold',
        color: textDark,
      })
      p5.text(marginX + 58, curY - 27, s.desc, { size: 7.5, font: 'regular', color: textMuted })
      curY -= 40
    }
    curY -= 10

    // Recursos de Segurança da Importação
    p5.text(marginX, curY, 'RECURSOS DE SEGURANÇA E CONFIABILIDADE DA IMPORTAÇÃO', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p5.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const impFeatures = [
      '• Simulação Prévia Obrigatória: Antes de qualquer gravação no banco, o sistema roda uma simulação detalhada apontando linhas válidas, avisos e eventuais inconsistências.',
      '• Download dos Modelos Oficiais: Na própria tela de importação há botões para baixar os arquivos modelos .xlsx formatados com as colunas corretas.',
      '• Modo Substituição Inteligente: Caso precise corrigir uma carga anterior, o sistema permite sobrescrever registros anteriores sem duplicidade indesejada.',
      '• Auditoria de Carga: Cada importação é registrada com hash de integridade, contagem de registros e usuário responsável.',
    ]
    for (const feat of impFeatures) {
      const lines = wrapText(feat, 88)
      for (const l of lines) {
        p5.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }
  }

  // -------------------------------------------------------------
  // PÁGINA 6: PERFIS, SEGURANÇA, TEMAS E ACESSO
  // -------------------------------------------------------------
  {
    const p6 = doc.addPage()
    addPageHeaderAndFooter(p6, 6, 7, 'Perfis de Acesso, Temas e Suporte')

    let curY = pageH - 65
    p6.text(marginX, curY, '6. PERFIS, SEGURANÇA MULTI-TENANT E USABILIDADE', {
      size: 14,
      font: 'bold',
      color: textDark,
    })
    p6.rect(marginX, curY - 5, 360, 2, { fillColor: greenPrimary })
    curY -= 22

    // Matriz de Perfis
    p6.text(marginX, curY, 'MATRIZ DE PERFIS E ALÇADAS DE ACESSO', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p6.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const profiles = [
      [
        'ADMINISTRADOR (ADMIN)',
        'Acesso total à empresa: configurações, usuários, importação, relatórios, auditoria e cadastros.',
      ],
      [
        'GESTÃO DE PESSOAS (HR)',
        'Gestão operacional: cadastra centros, setores, colaboradores, preenche e acompanha avaliações.',
      ],
      [
        'GESTOR DE OBRA (MANAGER_WORKSITE)',
        'Visibilidade restrita ao seu Centro de Custo/Obra para preenchimento das avaliações da sua equipe.',
      ],
      [
        'GESTOR DE SETOR (MANAGER_DEPARTMENT)',
        'Visibilidade restrita ao seu departamento/setor no escritório para avaliação dos seus liderados.',
      ],
      [
        'ASSISTENTE ADM (ADMIN_ASSISTANT)',
        'Apoio operacional no preenchimento de formulários e consultas de dados autorizados.',
      ],
      [
        'CONSULTA (VIEWER)',
        'Apenas visualização de relatórios e painéis de indicadores, sem permissão de edição.',
      ],
    ]

    for (const [prof, desc] of profiles) {
      p6.rect(marginX, curY - 3, 115, 14, { fillColor: cardBg, strokeColor: cardBorder })
      p6.text(marginX + 5, curY + 2, prof, { size: 6.5, font: 'bold', color: textDark })
      p6.text(marginX + 124, curY + 2, desc, { size: 8, font: 'regular', color: textDark })
      curY -= 17
    }
    curY -= 14

    // Isolamento Multi-tenant & Segurança
    p6.text(marginX, curY, 'SEGURANÇA E ISOLAMENTO MULTI-EMPRESA (MULTI-TENANT)', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p6.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const secDesc = [
      '• Dados 100% Isolados: Cada comprador opera em ambiente estritamente isolado. Nenhum usuário de outra empresa tem acesso a colaboradores, avaliações ou cadastros da sua organização.',
      '• Criptografia e Proteção de CPF: CPFs são mascarados na interface e protegidos por rotinas de hash e criptografia.',
      '• Auditoria Completa: Qualquer inclusão, alteração de nota ou exclusão gera registro perene na Trilha de Auditoria (Menu "Auditoria").',
    ]
    for (const sd of secDesc) {
      const lines = wrapText(sd, 88)
      for (const l of lines) {
        p6.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
        curY -= 12
      }
      curY -= 2
    }
    curY -= 14

    // Temas Claro e Escuro
    p6.text(marginX, curY, 'ALTERNÂNCIA DE TEMAS: MODO CLARO E MODO ESCURO', {
      size: 10.5,
      font: 'bold',
      color: textDark,
    })
    p6.line(marginX, curY - 4, pageW - marginX, curY - 4, { color: [0.85, 0.88, 0.85] })
    curY -= 18

    const themeDesc = wrapText(
      'O sistema dispõe de um botão no topo superior direito da barra de navegação para alternar entre "Tema Claro" e "Tema Escuro". A preferência do usuário é salva no navegador para proporcionar máximo conforto visual durante rotinas diurnas ou noturnas.',
      88,
    )
    for (const l of themeDesc) {
      p6.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
      curY -= 12
    }
  }

  // -------------------------------------------------------------
  // PÁGINA 7: GUIA DE MELHORES PRÁTICAS & CHECKLIST FINAL
  // -------------------------------------------------------------
  {
    const p7 = doc.addPage()
    addPageHeaderAndFooter(p7, 7, 7, 'Melhores Práticas e Resultados')

    let curY = pageH - 65
    p7.text(marginX, curY, '7. GUIA DE MELHORES PRÁTICAS PARA O MÁXIMO RESULTADO', {
      size: 14,
      font: 'bold',
      color: textDark,
    })
    p7.rect(marginX, curY - 5, 410, 2, { fillColor: greenPrimary })
    curY -= 22

    const bestIntro = wrapText(
      'Para que a sua organização alcance o melhor resultado absoluto, reduza o passivo trabalhista a zero e eleve a qualidade do processo seletivo e probatório, siga este checklist permanente de melhores práticas:',
      88,
    )
    for (const l of bestIntro) {
      p7.text(marginX, curY, l, { size: 8.5, font: 'regular', color: textDark })
      curY -= 12
    }
    curY -= 14

    const practices = [
      [
        'PRÁTICA 1',
        'Cadastre Centros de Custo e Setores ANTES de importar colaboradores.',
        'Evita inconsistências de vínculo e garante que todos os colaboradores recebam a matriz correta de critérios desde o primeiro dia.',
      ],
      [
        'PRÁTICA 2',
        'Revise o Padrão de Escritório antes de criar novos setores.',
        'Ajustar o padrão corporativo primeiro assegura que novos setores já herdem as diretrizes atualizadas da organização.',
      ],
      [
        'PRÁTICA 3',
        'Utilize exclusivamente as planilhas modelo oficiais .XLSX.',
        'Baixe os templates oficiais na tela de importação para evitar cabeçalhos divergentes ou falhas na conversão de datas.',
      ],
      [
        'PRÁTICA 4',
        'Monitore diariamente a janela de 5 dias de antecedência.',
        'Nunca deixe uma avaliação para o último dia. O status "No Prazo" é o sinal verde para o gestor reunir-se com o colaborador e dar o feedback probatório.',
      ],
      [
        'PRÁTICA 5',
        'Evite a Efetivação Tácita mantendo zero avaliações vencidas.',
        'Se o prazo de 90 dias expirar sem formalização, a lei presume a efetivação automática por prazo indeterminado, com custos rescisórios integrais.',
      ],
      [
        'PRÁTICA 6',
        'Estimule feedbacks construtivos no campo "Observações".',
        'Registrar justificativas ricas para notas regulares ou ruins cria base comprobatória documental indispensável para o departamento jurídico.',
      ],
    ]

    for (const [bp, title, desc] of practices) {
      p7.rect(marginX, curY - 32, pageW - 2 * marginX, 32, {
        fillColor: cardBg,
        strokeColor: cardBorder,
      })
      p7.rect(marginX + 6, curY - 24, 52, 14, { fillColor: darkHeader })
      p7.text(marginX + 10, curY - 14, bp, { size: 7.5, font: 'bold', color: greenPrimary })
      p7.text(marginX + 64, curY - 13, title, { size: 8.5, font: 'bold', color: textDark })
      p7.text(marginX + 64, curY - 25, desc, { size: 7.5, font: 'regular', color: textMuted })
      curY -= 38
    }
    curY -= 16

    // Bloco Final de Encerramento e Suporte
    p7.rect(marginX, curY - 80, pageW - 2 * marginX, 80, {
      fillColor: [0.93, 0.98, 0.94],
      strokeColor: [0.75, 0.9, 0.78],
    })
    p7.text(marginX + 14, curY - 18, 'CENTRAL DE ATENDIMENTO E SUPORTE CONTÍNUO', {
      size: 9.5,
      font: 'bold',
      color: [0.1, 0.5, 0.2],
    })
    p7.text(
      marginX + 14,
      curY - 34,
      'Conte com o nosso suporte técnico para dúvidas sobre configurações, regras de negócio ou treinamentos de equipe:',
      {
        size: 8,
        font: 'regular',
        color: textDark,
      },
    )
    p7.text(
      marginX + 14,
      curY - 50,
      'WhatsApp: (82) 99106-9350   •   E-mail de Suporte: valdknupp@gmail.com',
      {
        size: 9,
        font: 'bold',
        color: textDark,
      },
    )
    p7.text(
      marginX + 14,
      curY - 66,
      'Avaliação de Experiência © Todos os direitos reservados • Gestão de Pessoas e Compliance Trabalhista',
      {
        size: 7.5,
        font: 'oblique',
        color: textMuted,
      },
    )
  }

  return doc.build()
}
