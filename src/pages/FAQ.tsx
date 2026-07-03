import React from 'react';
import { motion } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  HelpCircle, 
  BarChart3, 
  FileText, 
  MessageSquare, 
  Target,
  ArrowRight,
  Terminal,
  WifiOff,
  UserCircle,
  CreditCard,
  Monitor,
  Smile,
  Mail,
  Lock,
  Image
} from 'lucide-react';

const FAQ: React.FC = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const sections = [
    {
      id: "passos-iniciais",
      title: "Passos Iniciais",
      icon: <Target className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "Como criar uma campanha?",
          a: "Vá para o menu 'Campanhas' e clique no botão '+ Nova Campanha'. Defina um nome, tipo (Interna ou Externa) e adicione as perguntas desejadas. Você pode escolher entre múltiplos formatos como SMILE 4, SMILE 5, NPS, Múltipla Escolha, Texto Aberto e mais."
        },
        {
          q: "O que é SMILE 4 vs SMILE 5?",
          a: "São escalas de satisfação por emojis. SMILE 4 tem 4 opções: Excelente, Bom, Regular e Ruim. SMILE 5 adiciona a 5ª opção: Muito Insatisfeito. Escolha a que melhor se adapta ao seu público."
        },
        {
          q: "Como personalizar a aparência dos surveys?",
          a: "Acesse seu Perfil e faça upload da logomarca da empresa. A imagem aparecerá automaticamente nos surveys dos terminais, no PDF dos relatórios e no link seguro de compartilhamento."
        },
        {
          q: "Como ativar ou desativar uma campanha?",
          a: "No menu Campanhas, use o botão de status para alternar entre 'Ativo' e 'Inativo'. Campanhas inativas não aparecem nos terminais e não coletam respostas até serem reativadas."
        }
      ]
    },
    {
      id: "terminais",
      title: "Terminais",
      icon: <Terminal className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "Como criar um terminal?",
          a: "Vá ao menu 'Terminais' e clique em 'Criar Terminal'. Dê um nome (ex: 'Totem Recepção'), selecione as campanhas vinculadas e pronto. O sistema gera automaticamente um email e senha de acesso."
        },
        {
          q: "O que são as credenciais do terminal?",
          a: "São o email e senha que o totem ou tablet físico usa para se autenticar no sistema. Após criar o terminal, clique no ícone de chave para visualizar e copiar as credenciais. Cole-as no dispositivo físico para iniciar a coleta."
        },
        {
          q: "Como gerar o QR Code para acesso rápido?",
          a: "Na lista de terminais, clique no ícone de QR Code. Ele gera um código visual e um link direto para o survey daquela campanha no terminal selecionado. Ideal para imprimir e colar no ponto de coleta."
        },
        {
          q: "Por que não consigo criar mais terminais?",
          a: "Seu plano atual tem um limite de terminais. Você pode ver seu limite no card 'Terminais' do Dashboard (ex: '3 / 5 terminais'). Para aumentar, entre em contato com o suporte."
        },
        {
          q: "O que é a URL de redirecionamento?",
          a: "É uma página para onde o usuário é enviado após responder o survey. Pode ser o site da empresa, uma página de agradecimento ou qualquer link. É opcional."
        }
      ]
    },
    {
      id: "analise-feedbacks",
      title: "Análise e Feedbacks",
      icon: <MessageSquare className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "Como acompanhar os feedbacks em tempo real?",
          a: "Acesse a página 'Monitoramento Online'. Lá você verá todos os terminais ativos, o status de conexão atual e a quantidade de registros coletados no período selecionado."
        },
        {
          q: "Como funcionam os filtros de data?",
          a: "No Dashboard e na página de Feedbacks, você pode filtrar por períodos pré-definidos (Hoje, 7 dias, 30 dias) ou personalizado. O sistema recalcula automaticamente todas as médias, porcentagens e gráficos com base no intervalo."
        },
        {
          q: "Como filtrar por terminal específico?",
          a: "No Dashboard, selecione o terminal desejado no filtro de terminais. Isso isola os dados daquele ponto de coleta, útil para comparar desempenho entre diferentes locais."
        },
        {
          q: "O que significa o gráfico de evolução?",
          a: "Mostra a tendência de satisfação ao longo dos últimos 7 dias. Cada ponto representa um dia e a porcentagem indica o nível de satisfação calculado com base nas respostas positivas (Muito Satisfeito/Satisfeito)."
        }
      ]
    },
    {
      id: "graficos-nps",
      title: "Gráficos e NPS",
      icon: <BarChart3 className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "O que é o NPS (Net Promoter Score)?",
          a: "É uma métrica de lealdade do cliente. Os respondentes dão notas de 0 a 10. Notas 9-10 são Promotores, 7-8 são Neutros e 0-6 são Detratores. O cálculo é: % Promotores - % Detratores. O resultado varia de -100 a 100."
        },
        {
          q: "O que os gráficos de percepção mostram?",
          a: "Eles consolidam as avaliações de satisfação (Excelente, Bom, Regular, Ruim) em barras visuais comparativas, permitindo identificar rapidamente o nível de satisfação geral sem precisar ler feedback por feedback."
        },
        {
          q: "Como é calculada a porcentagem de satisfação?",
          a: "Cada resposta recebe uma pontuação: Muito Satisfeito/Excelente = 100pts, Satisfeito/Bom = 75pts, Regular = 50pts, Ruim/Insatisfeito = 25pts. A satisfação final é a média ponderada de todas as respostas no período."
        }
      ]
    },
    {
      id: "relatorios-exportacao",
      title: "Relatórios e Exportação",
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "Como gerar um relatório profissional em PDF?",
          a: "No Dashboard, selecione a campanha e os filtros de data desejados. Clique em 'Gerar Relatório PDF'. O sistema criará um documento formatado com sua logomarca, resumo estatístico, gráficos e lista detalhada de feedbacks."
        },
        {
          q: "O que é o relatório automático por email?",
          a: "Você pode configurar um email para receber relatórios diários automáticos. Vá em 'Editar Campanha' e defina o 'Email de Relatório' e o 'Horário'. O sistema envia todos os dias um PDF com os dados do dia anterior."
        },
        {
          q: "Como compartilhar um relatório com alguém externo?",
          a: "No Dashboard, clique em 'Gerar Link Seguro'. O sistema cria um token de acesso único e expirável que permite visualizar o relatório online sem precisar de login. Ideal para enviar a clientes ou diretoria."
        },
        {
          q: "Como exportar os dados em planilha?",
          a: "Na página de Feedbacks, use o botão 'Exportar CSV' para baixar todas as respostas em formato de planilha, compatível com Excel e Google Sheets."
        }
      ]
    },
    {
      id: "modo-offline",
      title: "Modo Offline",
      icon: <WifiOff className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "O que acontece se a internet cair durante uma pesquisa?",
          a: "O survey offline salva todas as respostas localmente no dispositivo. Quando a conexão é restabelecida, os dados são sincronizados automaticamente com o servidor. Nenhuma resposta é perdida."
        },
        {
          q: "As imagens das perguntas funcionam offline?",
          a: "Sim. Quando o terminal está online pela primeira vez, as imagens são cacheadas automaticamente. Se a internet cair, o survey continua exibindo as imagens do cache local."
        },
        {
          q: "Como acessar o modo offline?",
          a: "Basta acessar a URL /survey-offline no terminal. A interface é igual ao survey normal, mas com capacidade de armazenamento local para funcionar sem conexão."
        }
      ]
    },
    {
      id: "conta-seguranca",
      title: "Conta e Segurança",
      icon: <UserCircle className="w-5 h-5 text-blue-600" />,
      content: [
        {
          q: "Como alterar minha senha?",
          a: "Acesse o menu Perfil e use a opção 'Alterar Senha'. Sua senha é criptografada no servidor para máxima segurança."
        },
        {
          q: "Como atualizar minha foto ou logomarca?",
          a: "No menu Perfil, clique na área de upload de imagem. Formatos aceitos: PNG e JPG, tamanho máximo 2MB. A imagem aparece nos surveys e relatórios."
        },
        {
          q: "Como sei qual é meu plano atual?",
          a: "No Dashboard, o card 'Terminais' mostra seu limite atual (ex: '3 / 5 terminais'). O número após a barra é o máximo permitido pelo seu plano. Se aparecer 'Ilimitado', você não tem restrição."
        },
        {
          q: "Minha conta foi bloqueada. O que fazer?",
          a: "Se você vê a mensagem 'Conta bloqueada. Entre em contato com o suporte', significa que o acesso da sua empresa foi suspenso. Entre em contato com a administração para regularizar."
        }
      ]
    }
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className={`min-h-screen pb-20 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#f8fafc]'}`}>
      {/* Header */}
      <div className={`border-b mb-8 transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="max-w-[1170px] mx-auto px-6 py-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-4"
          >
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <HelpCircle className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-blue-600 tracking-wider uppercase">Central de Ajuda</span>
          </motion.div>
          <h1 className={`text-4xl font-bold tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Como funciona o sistema?
          </h1>
          <p className={`text-lg max-w-2xl leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
            Bem-vindo à documentação oficial. Aqui você encontrará tudo o que precisa para dominar a plataforma e transformar feedbacks em resultados.
          </p>
        </div>
      </div>

      <div className="max-w-[1170px] mx-auto px-6 flex flex-col lg:flex-row gap-12">
        {/* Left Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 h-fit sticky top-24">
          <nav className="flex flex-col space-y-1">
            <p className={`text-xs font-bold uppercase tracking-widest mb-4 px-3 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Tópicos</p>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all text-left w-full group ${
                  isDarkMode 
                    ? 'text-zinc-400 hover:text-blue-500 hover:bg-white/5' 
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <span className="opacity-50 group-hover:opacity-100 transition-opacity">
                  {React.cloneElement(section.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
                </span>
                {section.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="grid gap-16">
            {sections.map((section, idx) => (
              <motion.div 
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="scroll-mt-24"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-1.5 border rounded-md shadow-sm transition-colors ${
                    isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
                  }`}>
                    {section.icon}
                  </div>
                  <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{section.title}</h2>
                </div>
                
                <div className="grid gap-4">
                  {section.content.map((item, i) => (
                    <div 
                      key={i}
                      className={`border rounded-xl p-6 transition-all group cursor-default shadow-sm hover:shadow-md ${
                        isDarkMode 
                          ? 'bg-zinc-900 border-white/5 hover:border-blue-500/50' 
                          : 'bg-white border-slate-100 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                            isDarkMode ? 'bg-black/50 border-white/10' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{i + 1}</span>
                          </div>
                        </div>
                        <div>
                          <h3 className={`font-bold mb-2 group-hover:text-blue-600 transition-colors ${isDarkMode ? 'text-zinc-100' : 'text-slate-900'}`}>
                            {item.q}
                          </h3>
                          <p className={`leading-relaxed text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                            {item.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Support Section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className={`mt-20 rounded-2xl p-10 text-center text-white relative overflow-hidden shadow-2xl transition-colors ${
              isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-slate-900'
            }`}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <HelpCircle size={150} />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-3">Ainda precisa de ajuda?</h2>
              <p className={`mb-8 max-w-md mx-auto ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Nosso time de suporte está disponível em horário comercial para tirar qualquer dúvida adicional.</p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-full font-bold transition-all flex items-center gap-2 mx-auto active:scale-95 shadow-lg shadow-blue-900/20">
                Falar com Suporte <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>

  );
};

export default FAQ;
