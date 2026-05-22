import { motion } from 'motion/react';
import { 
  FileText, 
  ArrowLeft, 
  Download, 
  Edit,
  Send,
  User,
  MapPin,
  Calendar,
  CreditCard,
  Package,
  Image as ImageIcon,
  PenTool,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  XCircle,
  File,
  AlignLeft
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = base64;
  });
};

export default function ViewProposal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchProposal = async () => {
      try {
        const data = await api.get(`/proposals/${id}`);
        setProposal(data);
      } catch (error) {
        toast.error('Erro ao carregar proposta');
      } finally {
        setLoading(false);
      }
    };
    fetchProposal();
  }, [id]);

  const handleSend = async () => {
    if (!proposal?.email) {
      toast.error('E-mail do cliente no informado.');
      return;
    }
    setSending(true);
    try {
      await api.post(`/proposals/${id}/send`, {});
      toast.success('Proposta enviada por e-mail!');
      const data = await api.get(`/proposals/${id}`);
      setProposal(data);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  };

  const generatePDF = async () => {
    if (!proposal) return;
    const doc = new jsPDF();
    const items = (proposal.items || []) as any[];
    const subtotal = items.reduce((sum: number, i: any) => sum + (parseFloat(i.total) || 0), 0);
    const shipping = proposal.shipping_cost || 0;
    const totalGeral = subtotal + shipping;

    // Header
    doc.setFillColor(11, 130, 255);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('beend.tech', 15, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Solucao Inteligente de Feedback', 15, 26);
    doc.setFontSize(10);
    doc.text(proposal.proposal_number, 195, 18, { align: 'right' });
    doc.setFontSize(8);
    doc.text(`Validade: ${new Date(proposal.validity_date).toLocaleDateString('pt-BR')}`, 195, 26, { align: 'right' });

    let y = 45;
    doc.setTextColor(50, 50, 50);

    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      'Rascunho': [120, 120, 120],
      'Enviada': [11, 130, 255],
      'Aprovada': [34, 197, 94],
      'Recusada': [239, 68, 68]
    };
    const sc = statusColors[proposal.status] || [120, 120, 120];
    doc.setFillColor(...sc);
    doc.roundedRect(15, y, 30, 7, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(proposal.status, 30, y + 5, { align: 'center' });
    y += 15;

    // Client info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados do Cliente', 15, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const clientInfoWidth = 175;
    const clientFields = [
      `Empresa: ${proposal.client_name}`,
      proposal.contact_person ? `Contato: ${proposal.contact_person}` : null,
      proposal.email ? `Email: ${proposal.email}` : null,
      proposal.phone ? `Telefone: ${proposal.phone}` : null,
      proposal.address ? `Endereco: ${proposal.address}` : null,
      `Data: ${new Date(proposal.proposal_date).toLocaleDateString('pt-BR')}`
    ].filter(Boolean);
    clientFields.forEach((field: string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const lines = doc.splitTextToSize(field, clientInfoWidth);
      doc.text(lines, 15, y);
      y += lines.length * 5;
    });
    y += 5;

    // Greeting + Description
    if (proposal.greeting || proposal.general_description) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Proposta', 15, y);
      y += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      if (proposal.greeting) {
        const greetingText = proposal.greeting + (proposal.client_name ? " " + proposal.client_name : "");
        if (greetingText.trim()) {
          const greetingLines = doc.splitTextToSize(greetingText, 180);
          doc.text(greetingLines, 15, y);
          y += greetingLines.length * 5;
        }
      }
      if (proposal.general_description) {
        y += 3;
        const descLines = doc.splitTextToSize(proposal.general_description, 180);
        doc.text(descLines, 15, y);
        y += descLines.length * 5;
      }
      y += 8;
    }

    // Resources
    const resources = Array.isArray(proposal.resources) ? proposal.resources : [];
    if (resources.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Recursos Inclusos', 15, y);
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      resources.forEach((r: string) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const rLines = doc.splitTextToSize(`• ${r}`, 170);
        doc.text(rLines, 20, y);
        y += rLines.length * 5;
      });
      y += 5;
    }

    // Items table
    if (items.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Itens e Valores', 15, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [['Item', 'Qtd', 'Unitário', 'Total']],
        body: items.map((i: any) => {
          const name = i.name || '-';
          const desc = i.description ? `\n${i.description}` : '';
          return [
            { content: `${name}${desc}`, styles: { fontSize: 8 } },
            String(i.qty || 1),
            `R$ ${formatCurrency(parseFloat(i.unit_price) || 0)}`,
            `R$ ${formatCurrency(parseFloat(i.total) || 0)}`
          ];
        }),
        foot: [
          ['', '', 'Subtotal:', `R$ ${formatCurrency(subtotal)}`],
          ...(shipping > 0 ? [['', '', 'Frete:', `R$ ${formatCurrency(shipping)}`]] : []),
          ['', '', 'TOTAL:', `R$ ${formatCurrency(totalGeral)}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [11, 130, 255], textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
        footStyles: { fontSize: 10, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [30, 30, 30] },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 45, halign: 'right' },
          3: { cellWidth: 45, halign: 'right' }
        },
        margin: { left: 15, right: 15 }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Payment terms
    if (proposal.payment_terms) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Forma de Pagamento', 15, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const payText = proposal.payment_terms;
      const payMatch = payText.match(/^([^:]+:)\s*/);
      if (payMatch) {
        doc.setFont('helvetica', 'bold');
        doc.text(payMatch[1], 15, y);
        const boldW = doc.getTextWidth(payMatch[1]);
        const rest = payText.substring(payMatch[0].length);
        doc.setFont('helvetica', 'normal');
        const restW = Math.max(100, 175 - boldW);
        const restLines = doc.splitTextToSize(rest, restW);
        if (restW >= 100 && restLines.length > 0) {
          doc.text(restLines[0], 15 + boldW, y);
          if (restLines.length > 1) {
            doc.text(restLines.slice(1), 15, y + 5);
            y += restLines.length * 5 + 2;
          } else {
            y += 6;
          }
        } else {
          doc.text(restLines, 15, y + 5);
          y += restLines.length * 5 + 7;
        }
      } else {
        doc.setFont('helvetica', 'normal');
        const payLines = doc.splitTextToSize(payText, 175);
        doc.text(payLines, 15, y);
        y += payLines.length * 5 + 3;
      }
      y += 3;
    }

    // Warranty
    if (proposal.warranty) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Garantia', 15, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const warText = proposal.warranty;
      const warMatch = warText.match(/^([^:]+:)\s*/);
      if (warMatch) {
        doc.setFont('helvetica', 'bold');
        doc.text(warMatch[1], 15, y);
        const boldW = doc.getTextWidth(warMatch[1]);
        const rest = warText.substring(warMatch[0].length);
        doc.setFont('helvetica', 'normal');
        const restW = Math.max(100, 175 - boldW);
        const restLines = doc.splitTextToSize(rest, restW);
        if (restW >= 100 && restLines.length > 0) {
          doc.text(restLines[0], 15 + boldW, y);
          if (restLines.length > 1) {
            doc.text(restLines.slice(1), 15, y + 5);
            y += restLines.length * 5 + 2;
          } else {
            y += 6;
          }
        } else {
          doc.text(restLines, 15, y + 5);
          y += restLines.length * 5 + 7;
        }
      } else {
        doc.setFont('helvetica', 'normal');
        const warLines = doc.splitTextToSize(warText, 175);
        doc.text(warLines, 15, y);
        y += warLines.length * 5 + 3;
      }
      y += 3;
    }

    // Technical support
    if (proposal.technical_support) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Suporte Técnico', 15, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const supText = proposal.technical_support;
      const supMatch = supText.match(/^([^:]+:)\s*/);
      if (supMatch) {
        doc.setFont('helvetica', 'bold');
        doc.text(supMatch[1], 15, y);
        const boldW = doc.getTextWidth(supMatch[1]);
        const rest = supText.substring(supMatch[0].length);
        doc.setFont('helvetica', 'normal');
        const restW = Math.max(100, 175 - boldW);
        const restLines = doc.splitTextToSize(rest, restW);
        if (restW >= 100 && restLines.length > 0) {
          doc.text(restLines[0], 15 + boldW, y);
          if (restLines.length > 1) {
            doc.text(restLines.slice(1), 15, y + 5);
            y += restLines.length * 5 + 2;
          } else {
            y += 6;
          }
        } else {
          doc.text(restLines, 15, y + 5);
          y += restLines.length * 5 + 7;
        }
      } else {
        doc.setFont('helvetica', 'normal');
        const supLines = doc.splitTextToSize(supText, 175);
        doc.text(supLines, 15, y);
        y += supLines.length * 5 + 3;
      }
      y += 3;
    }

    // Implementation requirements
    if (proposal.implementation_reqs) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Requisitos de Implementacao', 15, y);
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const reqLines = doc.splitTextToSize(proposal.implementation_reqs, 175);
      doc.text(reqLines, 15, y);
      y += reqLines.length * 5 + 8;
    }

    // Final considerations
    if (proposal.final_considerations) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Consideracoes Finais', 15, y);
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const consLines = doc.splitTextToSize(proposal.final_considerations, 180);
      doc.text(consLines, 15, y);
      y += consLines.length * 5 + 15;
    }

    // Observations
    if (proposal.observations) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Observacoes', 15, y);
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const obsLines = doc.splitTextToSize(proposal.observations, 180);
      doc.text(obsLines, 15, y);
      y += obsLines.length * 5 + 15;
    }

    // Images
    const proposalImages = (proposal.images || []).filter((i: string) => i);
    if (proposalImages.length > 0) {
      if (y > 180) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Imagens', 15, y);
      y += 10;
      
      const maxImgWidth = 55;
      const maxImgHeight = 40;
      let xPos = 15;
      let imgsInRow = 0;
      
      for (const imgUrl of proposalImages) {
        if (imgsInRow >= 3) {
          xPos = 15;
          y += maxImgHeight + 8;
          imgsInRow = 0;
        }
        if (y + maxImgHeight > 280) { doc.addPage(); y = 20; }
        
        try {
          const base64 = await loadImageAsBase64(imgUrl);
          if (base64) {
            // Get image dimensions to maintain aspect ratio
            const imgDims = await getImageDimensions(base64);
            const ratio = Math.min(maxImgWidth / imgDims.width, maxImgHeight / imgDims.height);
            const finalWidth = imgDims.width * ratio;
            const finalHeight = imgDims.height * ratio;
            
            // Center image in its cell
            const xOffset = xPos + (maxImgWidth - finalWidth) / 2;
            const yOffset = y + (maxImgHeight - finalHeight) / 2;
            
            doc.addImage(base64, 'JPEG', xOffset, yOffset, finalWidth, finalHeight);
          }
        } catch {}
        
        xPos += maxImgWidth + 8;
        imgsInRow++;
      }
      y += maxImgHeight + 15;
    }

    // Signature
    if (proposal.responsible_name) {
      if (y > 230) { doc.addPage(); y = 20; }
      y += 10;
      doc.setDrawColor(150, 150, 150);
      doc.line(15, y, 80, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(proposal.responsible_name, 15, y);
      if (proposal.responsible_phone) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(proposal.responsible_phone, 15, y + 5);
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`© ${new Date().getFullYear()} beend.tech - Todos os direitos reservados.`, 105, 290, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: 'right' });
    }

    doc.save(`Proposta ${proposal.proposal_number}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  if (loading) {
    return (
      <>
        <Breadcrumbs />
        <main className={`flex-1 p-6 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </>
    );
  }

  if (!proposal) {
    return (
      <>
        <Breadcrumbs />
        <main className={`flex-1 p-6 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
          <div className="text-center py-20">
            <FileText size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} />
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Proposta não encontrada</h3>
            <Link to="/propostas" className="text-amber-500 text-sm font-bold mt-2 inline-block">Voltar para listagem</Link>
          </div>
        </main>
      </>
    );
  }

  const items = (proposal.items || []) as any[];
  const subtotal = items.reduce((sum: number, i: any) => sum + (parseFloat(i.total) || 0), 0);
  const shipping = proposal.shipping_cost || 0;
  const totalGeral = subtotal + shipping;
  const resources = Array.isArray(proposal.resources) ? proposal.resources : [];

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      'Rascunho': { bg: isDarkMode ? 'bg-zinc-800' : 'bg-slate-100', text: isDarkMode ? 'text-zinc-400' : 'text-slate-600', icon: File },
      'Enviada': { bg: isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50', text: isDarkMode ? 'text-blue-400' : 'text-blue-600', icon: Send },
      'Aprovada': { bg: isDarkMode ? 'bg-green-500/10' : 'bg-green-50', text: isDarkMode ? 'text-green-400' : 'text-green-600', icon: CheckCircle2 },
      'Recusada': { bg: isDarkMode ? 'bg-red-500/10' : 'bg-red-50', text: isDarkMode ? 'text-red-400' : 'text-red-600', icon: XCircle }
    };
    const c = config[status] || config['Rascunho'];
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${c.bg} ${c.text}`}>
        <Icon size={14} /> {status}
      </span>
    );
  };

  const SectionCard = ({ icon: Icon, title, children }: any) => (
    <div className={`rounded-xl border overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
      <div className={`p-5 border-b flex items-center gap-3 ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
          <Icon size={18} />
        </div>
        <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link to="/propostas">
                <motion.button whileHover={{ scale: 1.1, x: -5 }}
                  className={`p-3 rounded-xl shadow-sm border transition-colors cursor-pointer ${isDarkMode ? 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-white' : 'bg-white border-slate-100 text-slate-400 hover:text-slate-800'}`}>
                  <ArrowLeft size={20} />
                </motion.button>
              </Link>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.proposal_number}</h2>
                  <StatusBadge status={proposal.status} />
                </div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>{proposal.client_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/propostas/editar/${id}`}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Edit size={14} /> Editar
                </motion.button>
              </Link>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={generatePDF}
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Download size={14} /> PDF
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleSend} disabled={sending}
                className="px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all">
                {sending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Enviar</>}
              </motion.button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Client */}
              <SectionCard icon={User} title="Dados do Cliente">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Empresa</span>
                    <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.client_name}</span>
                  </div>
                  {proposal.contact_person && (
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Contato</span>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.contact_person}</span>
                    </div>
                  )}
                  {proposal.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.email}</span>
                    </div>
                  )}
                  {proposal.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.phone}</span>
                    </div>
                  )}
                  {proposal.address && (
                    <div className="md:col-span-2 flex items-start gap-2">
                      <MapPin size={14} className={`mt-0.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
                    <span className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>Data: {new Date(proposal.proposal_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
                    <span className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>Validade: {new Date(proposal.validity_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </SectionCard>

              {/* Content */}
              {(proposal.greeting || proposal.general_description) && (
                <SectionCard icon={FileText} title="Proposta">
                  <div className={`space-y-4 text-sm leading-relaxed ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {proposal.greeting && (
                      <p className="font-bold">
                        {proposal.greeting}{proposal.client_name ? ` ${proposal.client_name}` : ""}
                      </p>
                    )}
                    {proposal.general_description && <p className="whitespace-pre-line">{proposal.general_description}</p>}
                  </div>
                </SectionCard>
              )}

              {resources.length > 0 && (
                <SectionCard icon={Package} title="Recursos Inclusos">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {resources.map((r: string, i: number) => (
                      <div key={i} className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Items */}
              {items.length > 0 && (
                <SectionCard icon={CreditCard} title="Itens e Valores">
                  <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={isDarkMode ? 'bg-black/40' : 'bg-slate-50'}>
                          <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-left ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Item</th>
                          <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Qtd</th>
                          <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Unitário</th>
                          <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {items.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className={`px-4 py-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              <span className="text-sm font-semibold">{item.name || '-'}</span>
                              {item.description && (
                                <p className={`text-xs mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>{item.description}</p>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-sm text-center ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>{item.qty || 1}</td>
                            <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>R$ {formatCurrency(parseFloat(item.unit_price) || 0)}</td>
                            <td className={`px-4 py-3 text-sm text-right font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>R$ {formatCurrency(parseFloat(item.total) || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className={isDarkMode ? 'bg-black/30' : 'bg-slate-50'}>
                          <td colSpan={3} className={`px-4 py-3 text-right text-sm font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Subtotal:</td>
                          <td className={`px-4 py-3 text-right text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>R$ {formatCurrency(subtotal)}</td>
                        </tr>
                        {shipping > 0 && (
                          <tr>
                            <td colSpan={3} className={`px-4 py-2 text-right text-sm ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Frete:</td>
                            <td className={`px-4 py-2 text-right text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>R$ {formatCurrency(shipping)}</td>
                          </tr>
                        )}
                        <tr className={isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'}>
                          <td colSpan={3} className={`px-4 py-3 text-right text-base font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>TOTAL:</td>
                          <td className={`px-4 py-3 text-right text-base font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {formatCurrency(totalGeral)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </SectionCard>
              )}

              {proposal.payment_terms && (
                <SectionCard icon={CreditCard} title="Forma de Pagamento">
                  <p className={`text-sm whitespace-pre-line ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {proposal.payment_terms.split(/(:\s*)/).map((part: string, i: number) => 
                      i === 0 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                </SectionCard>
              )}

              {proposal.warranty && (
                <SectionCard icon={CheckCircle2} title="Garantia">
                  <p className={`text-sm whitespace-pre-line ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {proposal.warranty.split(/(:\s*)/).map((part: string, i: number) => 
                      i === 0 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                </SectionCard>
              )}

              {proposal.technical_support && (
                <SectionCard icon={User} title="Suporte Técnico">
                  <p className={`text-sm whitespace-pre-line ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {proposal.technical_support.split(/(:\s*)/).map((part: string, i: number) => 
                      i === 0 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                </SectionCard>
              )}

              {proposal.final_considerations && (
                <SectionCard icon={FileText} title="Considerações Finais">
                  <p className={`text-sm whitespace-pre-line ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>{proposal.final_considerations}</p>
                </SectionCard>
              )}

              {proposal.observations && (
                <SectionCard icon={AlignLeft} title="Observações">
                  <p className={`text-sm whitespace-pre-line ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>{proposal.observations}</p>
                </SectionCard>
              )}

              {/* Images */}
              {proposal.images && proposal.images.length > 0 && proposal.images.some((i: string) => i) && (
                <SectionCard icon={ImageIcon} title="Imagens">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {proposal.images.filter((i: string) => i).map((img: string, idx: number) => (
                      <div key={idx} className={`aspect-video rounded-lg overflow-hidden border ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                        <img src={img} alt={`Proposta ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Signature */}
              {proposal.responsible_name && (
                <SectionCard icon={PenTool} title="Assinatura">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Responsável</span>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.responsible_name}</span>
                    </div>
                    {proposal.responsible_phone && (
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Telefone</span>
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.responsible_phone}</span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                <h4 className={`text-sm font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Resumo</h4>
                <div className={`space-y-3 text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                  <div className="flex justify-between">
                    <span>Plano:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{proposal.plan_type || '-'}</span>
                  </div>
                  {proposal.monthly_value > 0 && (
                    <div className="flex justify-between">
                      <span>Valor Mensal:</span>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>R$ {formatCurrency(proposal.monthly_value || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Itens:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{items.length}</span>
                  </div>
                  <div className={`border-t pt-3 mt-3 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>R$ {formatCurrency(subtotal)}</span>
                    </div>
                    {shipping > 0 && (
                      <div className="flex justify-between mt-1">
                        <span>Frete:</span>
                        <span>R$ {formatCurrency(shipping)}</span>
                      </div>
                    )}
                    <div className="flex justify-between mt-2 pt-2 border-t border-amber-500/20">
                      <span className={`font-black text-lg ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Total:</span>
                      <span className={`font-black text-lg ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {formatCurrency(totalGeral)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {proposal.plan_description && (
                <div className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                  <h4 className={`text-sm font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Descrição do Plano</h4>
                  <p className={`text-xs whitespace-pre-line ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{proposal.plan_description}</p>
                </div>
              )}

              <div className={`p-6 rounded-xl shadow-sm border transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                <h4 className={`text-sm font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Ações Rápidas</h4>
                <div className="space-y-2">
                  <Link to={`/propostas/editar/${id}`}
                    className={`w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${isDarkMode ? 'border-white/5 text-zinc-400 hover:text-white hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                    <Edit size={14} /> Editar Proposta
                  </Link>
                  <button onClick={generatePDF}
                    className={`w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${isDarkMode ? 'border-white/5 text-zinc-400 hover:text-white hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                    <Download size={14} /> Baixar PDF
                  </button>
                  <button onClick={handleSend} disabled={sending}
                    className="w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-amber-500 text-white hover:bg-amber-600 transition-all">
                    {sending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Enviar por Email</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
