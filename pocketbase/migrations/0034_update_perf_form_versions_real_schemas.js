// Migration 0034: Atualiza formulários de Avaliação de Desempenho (Nível I e Nível II)
// Cria a nova versão 2 publicada com as perguntas reais e cabeçalhos oficiais (v1 anterior mantida como Inativo).
// Nenhum dado de resposta, pessoa ou nota das planilhas de exemplo entra nesta migração.

migrate(
  (app) => {
    const perfFormVersions = app.findCollectionByNameOrId('perf_form_versions')

    // Schema Nível I
    const nivelISchema = {
      title: 'Avaliação de Desempenho — Nível I',
      description:
        'Formulário de avaliação de desempenho para colaboradores de nível I. Responda com atenção — as respostas fazem parte do histórico do colaborador.',
      sections: [
        {
          id: 's_identificacao',
          title: 'Identificação',
          description: 'Dados gerais da avaliação de desempenho.',
          questions: [
            { id: 'q_data', type: 'date', label: 'Data:', required: true },
            {
              id: 'q_colaborador',
              type: 'collaborator_select',
              label: 'Colaborador:',
              required: true,
            },
            { id: 'q_gestor', type: 'text', label: 'Gestor:', required: true },
          ],
        },
        {
          id: 's_competencias',
          title: 'Competências e Desempenho',
          description:
            'Avalie cada competência com base nas entregas e atitudes observadas no período.',
          questions: [
            {
              id: 'q_dominio_processos',
              type: 'radio',
              label:
                '1. Domínio dos processos de trabalho\nPossui conhecimento sobre os processos e sistemas que opera, de forma a não apenas executá-los, mas também compreendê-los e analisá-los criticamente, contribuindo para a melhoria contínua e garantindo que o setor cumpra as demandas de maneira eficiente?\n\nPalavras-chave: Conhecimento técnico e senso de análise crítica, oportunidades de melhoria, eficiência e crescimento profissional.',
              required: true,
              options: [
                'Cumpre as necessidades dos processos - ATENDE',
                'Precisa melhorar em alguma etapa da execução - ATENDE PARCIALMENTE',
                'Precisa de orientação e instruções para execução do meu trabalho - NÃO ATENDE',
                'Cumpre as necessidades dos processos, sugerindo melhorias - SUPERA',
              ],
            },
            {
              id: 'q_dominio_processos_comentarios',
              type: 'textarea',
              label:
                'Comentários gerais:\nPrincipais aspectos do seu desempenho (pontos fortes e pontos a melhorar).',
              required: false,
            },
            {
              id: 'q_qualidade_trabalho',
              type: 'radio',
              label:
                '2. Qualidade do trabalho\nMantém as informações e registros em conformidade com os padrões estabelecidos, garantindo organização e planejamento para atender às necessidades dos setores demandantes e da equipe, além de contribuir para a execução eficiente dos processos?\n\nPalavras-chave: Organização e planejamento, conformidade, eficiência dos processos e excelência:',
              required: true,
              options: [
                'Atende aos padrões da qualidade estabelecidos - ATENDE',
                'Precisa melhorar em algum requisito da qualidade - ATENDE PARCIALMENTE',
                'Não atende os principais padrões estabelecidos - NÃO ATENDE',
                'Atende aos padrões de qualidade estabelecidos, sugerindo melhorias - SUPERA',
              ],
            },
            {
              id: 'q_qualidade_trabalho_comentarios',
              type: 'textarea',
              label:
                'Comentários gerais:\nPrincipais aspectos do seu desempenho (pontos fortes e pontos a melhorar).',
              required: false,
            },
            {
              id: 'q_produtividade_trabalho',
              type: 'radio',
              label:
                '3. Produtividade de trabalho\nCumpre os prazos com qualidade e eficiência, trabalhando de maneira inteligente para entregar resultados superiores com menos esforço e tempo, alcançando seus objetivos ao otimizar o uso dos recursos disponíveis?\n\nPalavras-chave: Foco em objetivos, metas, entregas dentro dos prazos e otimização de recursos.',
              required: true,
              options: [
                'Atende aos padrões de produtividade com qualidade - ATENDE',
                'Precisa melhorar minha produtividade de trabalho - ATENDE PARCIALMENTE',
                'Não atende aos padrões de produtividade estabelecidos - NÃO ATENDE',
                'Atende aos padrões de produtividade com qualidade, sugerindo melhorias - SUPERA',
              ],
            },
            {
              id: 'q_produtividade_trabalho_comentarios',
              type: 'textarea',
              label:
                'Comentários gerais:\nPrincipais aspectos do seu desempenho (pontos fortes e pontos a melhorar).',
              required: false,
            },
            {
              id: 'q_solucao_problemas',
              type: 'radio',
              label:
                '4. Solução de problemas\nDemonstra proatividade nas intervenções relacionadas às suas atividades, promovendo a mediação de conflitos entre seu setor e os demais. Adapta-se rapidamente às mudanças na rotina, contribuindo para a manutenção de um ambiente harmônico?\n\nPalavras-chave: Capacidade de negociação, geração de conhecimento e cooperação.',
              required: true,
              options: [
                'Participa e possui abordagem adequada na solução e prevenção de problemas - ATENDE',
                'Precisa melhorar na abordagem, solução e/ou prevenção de problemas - ATENDE PARCIALMENTE',
                'Precisa participar da prevenção e solução de problemas - NÃO ATENDE',
                'Participa sugerindo melhorias de processos na solução e prevenção de problemas - SUPERA',
              ],
            },
            {
              id: 'q_solucao_problemas_comentarios',
              type: 'textarea',
              label:
                'Comentários gerais:\nPrincipais aspectos do seu desempenho (pontos fortes e pontos a melhorar).',
              required: false,
            },
            {
              id: 'q_colaboracao',
              type: 'radio',
              label:
                '5. Colaboração\nPossui habilidades interpessoais, sendo colaborativo e acolhedor, o que lhe permite construir relações sólidas e promover a inteligência coletiva. Compartilha as melhores práticas, facilita a adaptação de novos colaboradores e busca integrar os membros à equipe, com um foco constante na promoção da diversidade e na busca pela excelência?\n\nPalavras-chave: Relacionamento interpessoal, empatia, integração, motivação e discrição.',
              required: true,
              options: [
                'Apresenta comportamentos integrativos e colaborativos com consistência - ATENDE',
                'Precisa melhorar em algum aspecto de comportamentos integrativos e colaborativos - ATENDE PARCIALMENTE',
                'Não apresenta comportamentos integrativos e colaborativos - NÃO ATENDE',
                'Possui excelência nos relacionamentos interpessoais e sou colaborativo - SUPERA',
              ],
            },
            {
              id: 'q_colaboracao_comentarios',
              type: 'textarea',
              label:
                'Comentários gerais:\nPrincipais aspectos do desempenho do colaborador (pontos fortes e pontos a melhorar).',
              required: false,
            },
          ],
        },
      ],
    }

    const escalaNivelII = ['ATENDE', 'ATENDE PARCIALMENTE', 'SUPERA', 'NÃO ATENDE']

    // Schema Nível II
    const nivelIISchema = {
      title: 'Avaliação de Desempenho — Nível II',
      description:
        'Formulário de avaliação de desempenho para colaboradores de nível II (líderes e supervisores). Responda com atenção — as respostas fazem parte do histórico do colaborador.',
      sections: [
        {
          id: 's_identificacao',
          title: 'Identificação',
          description: 'Dados gerais da avaliação de desempenho.',
          questions: [
            { id: 'q_data', type: 'date', label: 'Data:', required: true },
            { id: 'q_avaliado', type: 'collaborator_select', label: 'Avaliado:', required: true },
            { id: 'q_gestor', type: 'text', label: 'Gestor:', required: true },
          ],
        },
        {
          id: 's_clima_organizacional',
          title: 'CLIMA ORGANIZACIONAL',
          description:
            'Avaliação das atitudes, ética, transparência e convivência no ambiente corporativo.',
          questions: [
            {
              id: 'q_clima_etica_transparencia',
              type: 'radio',
              label:
                'Ética e transparência: Age com honestidade e justiça no relacionamento com colegas do mesmo nível hierárquico, membros da equipe, fornecedores e clientes. Compartilha informações de forma clara e transparente, preservando apenas o que for confidencial.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_clima_relacionamento_interpessoal',
              type: 'radio',
              label:
                'Relacionamento interpessoal: Constrói e mantém relacionamentos positivos com colegas de sua área, de outras áreas e parceiros externos, favorecendo a cooperação e o bom andamento das atividades.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_clima_respeito_ambiente',
              type: 'radio',
              label:
                'Respeito e ambiente de trabalho: Demonstra abertura ao diálogo, respeita opiniões diferentes e contribui para um ambiente de trabalho saudável, leve e respeitoso.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_clima_comentarios_gerais',
              type: 'textarea',
              label: 'Comentários gerais:',
              required: false,
            },
          ],
        },
        {
          id: 's_crescimento',
          title: 'CRESCIMENTO',
          description:
            'Avaliação da busca por desenvolvimento profissional, maturidade e pensamento crítico.',
          questions: [
            {
              id: 'q_crescimento_autodesenvolvimento',
              type: 'radio',
              label:
                'Autodesenvolvimento: Demonstra interesse em aprender novas habilidades e aplicar melhorias no trabalho, participando das ações de desenvolvimento promovidas pela empresa.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_crescimento_pensamento_critico',
              type: 'radio',
              label:
                'Pensamento crítico: Avalia suas atividades de forma crítica a fim de melhorar o processo e entregar suas tarefas com mais eficiência.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_crescimento_inteligencia_emocional',
              type: 'radio',
              label:
                'Inteligência emocional: Busca desenvolver não apenas competências técnicas, mas também habilidades emocionais e relacionais.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_crescimento_comentarios_gerais',
              type: 'textarea',
              label: 'Comentários gerais:',
              required: false,
            },
          ],
        },
        {
          id: 's_performance_resultados',
          title: 'PERFORMANCE e RESULTADOS',
          description:
            'Avaliação da entrega de metas, qualidade operacional, conformidade e proatividade.',
          questions: [
            {
              id: 'q_performance_foco_resultados',
              type: 'radio',
              label:
                'Foco em resultados: Planeja e executa suas atividades com foco no cumprimento de metas e prazos, implementando planos de ação e garantindo resultados com eficiência operacional.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_performance_comprometimento',
              type: 'radio',
              label:
                'Comprometimento: Demonstra empenho na realização das atividades, buscando entregar as tarefas com qualidade e dedicação, muitas vezes superando as expectativas.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_performance_qualidade_conformidade',
              type: 'radio',
              label:
                'Qualidade e conformidade: Realiza suas atividades observando os princípios da qualidade, respeitando normas, procedimentos e requisitos de segurança, higiene e meio ambiente, atuando de forma preventiva para evitar problemas.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_performance_proatividade',
              type: 'radio',
              label:
                'Proatividade: Age com iniciativa e agilidade diante das demandas, identificando oportunidades de melhoria e solucionando problemas antes que se ampliem.',
              required: true,
              options: escalaNivelII,
            },
            {
              id: 'q_performance_comentarios_gerais',
              type: 'textarea',
              label: 'Comentários gerais:',
              required: false,
            },
          ],
        },
      ],
    }

    // Marca versões anteriores como 'Inativo' para preservar histórico de avaliações existentes
    app
      .db()
      .newQuery("UPDATE perf_form_versions SET status = 'Inativo' WHERE status = 'Publicado'")
      .execute()

    // Cria versão 2 para Nível I
    const recNivelI = new Record(perfFormVersions)
    recNivelI.set('form_key', 'NIVEL_I')
    recNivelI.set('version', 2)
    recNivelI.set('title', 'Avaliação de Desempenho — Nível I')
    recNivelI.set(
      'subtitle',
      'Formulário de avaliação de desempenho para colaboradores de nível I. Responda com atenção — as respostas fazem parte do histórico do colaborador.',
    )
    recNivelI.set('status', 'Publicado')
    recNivelI.set('schema', JSON.stringify(nivelISchema))
    app.save(recNivelI)

    // Cria versão 2 para Nível II
    const recNivelII = new Record(perfFormVersions)
    recNivelII.set('form_key', 'NIVEL_II')
    recNivelII.set('version', 2)
    recNivelII.set('title', 'Avaliação de Desempenho — Nível II')
    recNivelII.set(
      'subtitle',
      'Formulário de avaliação de desempenho para colaboradores de nível II (líderes e supervisores). Responda com atenção — as respostas fazem parte do histórico do colaborador.',
    )
    recNivelII.set('status', 'Publicado')
    recNivelII.set('schema', JSON.stringify(nivelIISchema))
    app.save(recNivelII)
  },
  (app) => {
    // Reversão: remove versão 2 e reativa versão 1
    app.db().newQuery('DELETE FROM perf_form_versions WHERE version = 2').execute()
    app
      .db()
      .newQuery("UPDATE perf_form_versions SET status = 'Publicado' WHERE version = 1")
      .execute()
  },
)
