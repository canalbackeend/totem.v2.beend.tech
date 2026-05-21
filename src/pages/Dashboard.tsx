import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LabelList,
  ResponsiveContainer 
} from 'recharts';
import { Trophy, Frown, Meh, Smile, Eye, Download, TrendingUp, FileText, Laugh, Angry, X } from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useTheme } from '../contexts/ThemeContext';

const drawSmileyFace = (doc: any, x: number, y: number, type: string) => {
  let color = [34, 197, 93]; // green
  if (type === 'smile') color = [163, 230, 53]; // light green
  if (type === 'meh') color = [234, 179, 8]; // yellow/gold
  if (type === 'sad') color = [249, 115, 22]; // orange
  if (type === 'angry') color = [239, 68, 68]; // red

  // Outer circle
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.circle(x, y, 1.4, 'F');

  // Draw eyes (white dots)
  doc.setFillColor(255, 255, 255);
  doc.circle(x - 0.45, y - 0.35, 0.22, 'F');
  doc.circle(x + 0.45, y - 0.35, 0.22, 'F');

  // Draw mouth (white lines)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  if (type === 'happy' || type === 'smile') {
    doc.line(x - 0.5, y + 0.35, x + 0.5, y + 0.35);
    doc.line(x - 0.5, y + 0.35, x - 0.5, y + 0.15);
    doc.line(x + 0.5, y + 0.35, x + 0.5, y + 0.15);
  } else if (type === 'meh') {
    doc.line(x - 0.5, y + 0.45, x + 0.5, y + 0.45);
  } else {
    // sad or angry
    doc.line(x - 0.5, y + 0.55, x + 0.5, y + 0.55);
    doc.line(x - 0.5, y + 0.55, x - 0.5, y + 0.35);
    doc.line(x + 0.5, y + 0.55, x + 0.5, y + 0.35);
  }
};

const drawLargeSmileyFace = (doc: any, x: number, y: number, score: number) => {
  let type = 'happy';
  if (score >= 80) type = 'happy';
  else if (score >= 65) type = 'smile';
  else if (score >= 50) type = 'meh';
  else if (score >= 35) type = 'sad';
  else type = 'angry';

  let color = [34, 197, 93]; // green
  if (type === 'smile') color = [163, 230, 53]; // light green
  if (type === 'meh') color = [234, 179, 8]; // yellow/gold
  if (type === 'sad') color = [249, 115, 22]; // orange
  if (type === 'angry') color = [239, 68, 68]; // red

  // Outer circle
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.circle(x, y, 3.5, 'F');

  // Draw eyes (white dots)
  doc.setFillColor(255, 255, 255);
  doc.circle(x - 1.1, y - 0.9, 0.55, 'F');
  doc.circle(x + 1.1, y - 0.9, 0.55, 'F');

  // Draw mouth (white lines)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  if (type === 'happy' || type === 'smile') {
    doc.line(x - 1.3, y + 0.9, x + 1.3, y + 0.9);
    doc.line(x - 1.3, y + 0.9, x - 1.3, y + 0.4);
    doc.line(x + 1.3, y + 0.9, x + 1.3, y + 0.4);
  } else if (type === 'meh') {
    doc.line(x - 1.3, y + 1.1, x + 1.3, y + 1.1);
  } else {
    // sad or angry
    doc.line(x - 1.3, y + 1.3, x + 1.3, y + 1.3);
    doc.line(x - 1.3, y + 1.3, x - 1.3, y + 0.8);
    doc.line(x + 1.3, y + 1.3, x + 1.3, y + 0.8);
  }
};

export default function Dashboard() {
  const { user, isAdmin, isMasterAdmin, profile, isTerminal } = useAuth();
  const location = useLocation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [terminalsList, setTerminalsList] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [responses, setResponses] = useState<any[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Helper to get stats for a specific question
  const getQuestionStats = (qText: string, qType: string) => {
    let relevantAnswers: any[] = [];
    
    responses.forEach(r => {
      // Parse answers if it's a string (sometimes JSONB comes as string depending on insertion)
      let parsedAnswers = [];
      if (typeof r.answers === 'string') {
        try { parsedAnswers = JSON.parse(r.answers); } catch (e) {}
      } else if (Array.isArray(r.answers)) {
        parsedAnswers = r.answers;
      }

      const qAnswers = parsedAnswers.filter((a: any) => a.question === qText).map((a: any) => a.answer);
      
      qAnswers.forEach(ans => {
        if (Array.isArray(ans)) {
          relevantAnswers.push(...ans);
        } else if (ans !== null && ans !== undefined) {
          relevantAnswers.push(ans);
        }
      });
    });
    
    // Total respondents who answered this question (not total selections)
    const respondentCount = responses.filter(r => {
      let parsed = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
      return (parsed || []).some((a: any) => a.question === qText && a.answer != null && (!Array.isArray(a.answer) || a.answer.length > 0));
    }).length;

    const count = relevantAnswers.length;
    if (respondentCount === 0) return { count: 0, respondentCount: 0, satisfaction: 0, distribution: {} as Record<string, number> };

    const distribution: Record<string, number> = {};
    let score = 0;

    relevantAnswers.forEach(ans => {
      const val = String(ans).toUpperCase();
      distribution[val] = (distribution[val] || 0) + 1;

      // Weights for satisfaction (Excelente=100, Bom=75, Regular=50, Ruim=25, Muito Insatisfeito=0 if applicable)
      // Standardizing to the 4 categories we track
      if (['MUITO SATISFEITO', 'EXCELENTE', 'MUITO BOM'].includes(val) || (typeof ans === 'number' && ans >= 9)) score += 100;
      else if (['SATISFEITO', 'BOM'].includes(val) || (typeof ans === 'number' && ans >= 7 && ans <= 8)) score += 75;
      else if (['REGULAR'].includes(val) || (typeof ans === 'number' && ans >= 5 && ans <= 6)) score += 50;
      else if (['RUIM', 'PÉSSIMO', 'INSATISFEITO', 'MUITO INSATISFEITO'].includes(val) || (typeof ans === 'number' && ans <= 4)) score += 25;
    });

    return {
      count,
      respondentCount,
      satisfaction: score / Math.max(1, count),
      distribution
    };
  };

  const formatPercent = (val: number) => {
    return val.toFixed(2).replace('.', ',');
  };

  const calculatePercentages = (counts: number[]) => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return counts.map(() => "0,00");
    
    // Round each to 2 decimal places in basis points (100.00% = 10000 bps)
    const basisPoints = counts.map(c => Math.round((c / total) * 10000));
    let sum = basisPoints.reduce((a, b) => a + b, 0);
    let diff = 10000 - sum;
    
    if (diff !== 0) {
      // Find the index(es) with the most responses to absorbed the diff
      // This ensures that small identical values stay identical
      const maxVal = Math.max(...counts);
      const maxIndices = counts.map((c, i) => c === maxVal ? i : -1).filter(i => i !== -1);
      
      // Distribute the diff among max indices. 
      // If there's a tie for max, we distribute even if it splits them (unavoidable if total must be 100.00)
      for (let i = 0; i < Math.abs(diff); i++) {
        const targetIdx = maxIndices[i % maxIndices.length];
        basisPoints[targetIdx] += (diff > 0 ? 1 : -1);
      }
    }
    
    return basisPoints.map(bp => (bp / 100).toFixed(2).replace('.', ','));
  };

  const [activeShortcut, setActiveShortcut] = useState<number | null>(null);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setActiveShortcut(days);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedTerminalId('all');
    setActiveShortcut(null);
  };
  
  // Filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('all');

  useEffect(() => {
    if (isTerminal && user?.terminal_id) {
      setSelectedTerminalId(user.terminal_id);
    }
  }, [isTerminal, user]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [campaignsData, terminalsData] = await Promise.all([
          api.get('/campaigns'),
          api.get('/terminals')
        ]);
        
        if (campaignsData) {
          let activeCampaigns = (campaignsData || []).filter((c: any) => c.status === 'Ativo');
          
          if (isTerminal && user?.terminal_id) {
            const currentTerminal = terminalsData?.find((t: any) => t.id === user.terminal_id);
            if (currentTerminal) {
              let terminalCampaignNames = currentTerminal.campaigns;
              if (typeof terminalCampaignNames === 'string') {
                try {
                  terminalCampaignNames = JSON.parse(terminalCampaignNames);
                } catch (e) {
                  // If it's just a raw value or empty
                  terminalCampaignNames = terminalCampaignNames ? [terminalCampaignNames] : [];
                }
              }
              const namesArray = Array.isArray(terminalCampaignNames) ? terminalCampaignNames : [];
              activeCampaigns = activeCampaigns.filter((c: any) => namesArray.includes(c.name));
            }
          }

          setCampaigns(activeCampaigns);
          if (activeCampaigns.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(activeCampaigns[0].id);
          }
        }

        if (terminalsData) {
          setTerminalsList(terminalsData);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };
    fetchData();

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user, location.pathname, selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    
    const fetchResponses = async () => {
      setResponsesLoading(true);
      try {
        let endpoint = `/responses?campaign_id=${selectedCampaignId}`;
        if (startDate) endpoint += `&startDate=${startDate}`;
        if (endDate) endpoint += `&endDate=${endDate}`;
        if (selectedTerminalId !== 'all') endpoint += `&terminal_id=${selectedTerminalId}`;

        const data = await api.get(endpoint);
        setResponses(data || []);
      } catch (err) {
        console.error('Error fetching responses:', err);
      } finally {
        setResponsesLoading(false);
      }
    };

    fetchResponses();
  }, [selectedCampaignId, startDate, endDate, selectedTerminalId]);

  const handleExportConsolidado = () => {
    toast.success('Exportando CSV Consolidado...', {
      description: 'O arquivo será baixado em instantes.'
    });
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || null;

  // Compute metrics from responses dynamically for true accuracy in the top cards
  let topPromotores = 0;
  let topNeutros = 0;
  let topDetratores = 0;
  let topTotalEngagement = 0;
  let topScore = 0;

  // For top cards, use NPS question if available, otherwise fallback to SMILE 5 or SMILE 4
  let primaryQuestion = selectedCampaign?.questions?.find((q: any) => q.type === 'NPS');
  if (!primaryQuestion) {
    primaryQuestion = selectedCampaign?.questions?.find((q: any) => q.type === 'SMILE 5');
  }
  if (!primaryQuestion) {
    primaryQuestion = selectedCampaign?.questions?.find((q: any) => q.type === 'SMILE 4');
  }

  if (primaryQuestion) {
    const qStats = getQuestionStats(primaryQuestion.text, primaryQuestion.type);
    topTotalEngagement = qStats.respondentCount;

    responses.forEach(r => {
      let parsed = [];
      if (typeof r.answers === 'string') {
        try { parsed = JSON.parse(r.answers); } catch (e) {}
      } else if (Array.isArray(r.answers)) {
        parsed = r.answers;
      }
      
      const pAnswer = parsed.find((a: any) => a.question === primaryQuestion.text)?.answer;
      if (pAnswer !== undefined && pAnswer !== null) {
        if (primaryQuestion.type === 'NPS') {
          const val = Number(pAnswer);
          if (!isNaN(val)) {
            if (val >= 9) topPromotores++;
            else if (val >= 7) topNeutros++;
            else topDetratores++;
          }
        } else if (primaryQuestion.type === 'SMILE 5') {
          const val = String(pAnswer).toUpperCase();
          if (['MUITO SATISFEITO', 'SATISFEITO', 'MUITO BOM', 'EXCELENTE'].includes(val) || pAnswer === 5) topPromotores++;
          else if (['REGULAR'].includes(val) || pAnswer === 3) topNeutros++;
          else if (['INSATISFEITO', 'MUITO INSATISFEITO', 'RUIM', 'PÉSSIMO'].includes(val) || pAnswer <= 2) topDetratores++;
        } else if (primaryQuestion.type === 'SMILE 4') {
          const val = String(pAnswer).toUpperCase();
          if (['EXCELENTE', 'BOM'].includes(val) || pAnswer >= 3) topPromotores++;
          else if (['REGULAR'].includes(val) || pAnswer === 2) topNeutros++;
          else if (['RUIM', 'PÉSSIMO'].includes(val) || pAnswer === 1) topDetratores++;
        }
      }
    });

    if (topTotalEngagement > 0) {
      if (primaryQuestion.type === 'NPS') {
        topScore = ((topPromotores - topDetratores) / topTotalEngagement) * 100;
      } else {
        // Fallback scoring for Smile questions using the same satisfaction logic
        topScore = qStats.satisfaction;
      }
    }
  }

  // Calculate generic satisfaction for the EVOLUTION line chart (Prioritize Smile, Fallback to NPS)
  const allSmileQuestions = selectedCampaign?.questions?.filter((q: any) => ['SMILE 4', 'SMILE 5'].includes(q.type)) || [];
  const hasNpsQuestion = selectedCampaign?.questions?.some((q: any) => q.type === 'NPS');
  
  let totalSatScoreCounter = 0;
  let parsedSatEngagement = 0;
  
  if (allSmileQuestions.length > 0) {
    let combinedCount = 0;
    let combinedScore = 0;
    allSmileQuestions.forEach((sq: any) => {
      const qs = getQuestionStats(sq.text, sq.type);
      if (qs.count > 0) {
         combinedCount += 1;
         combinedScore += qs.satisfaction;
      }
    });
    if (combinedCount > 0) {
      totalSatScoreCounter = combinedScore;
      parsedSatEngagement = combinedCount;
    }
  } else if (hasNpsQuestion) {
    // If no smile questions, use NPS as satisfaction fallback for the chart
    totalSatScoreCounter = topScore;
    parsedSatEngagement = 1;
  }

  const currentSatisfaction = parsedSatEngagement > 0 ? (totalSatScoreCounter / parsedSatEngagement) : 0;

  const handleGerarRelatorio = async () => {
    if (!selectedCampaign) {
      toast.error('Selecione uma campanha primeiro.');
      return;
    }

    toast.info('Gerando relatório PDF de alta qualidade...');

    // Helper to get image base64 on client side through our proxy endpoint
    const getBase64Image = async (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        if (url.startsWith('http://') || url.startsWith('https://')) {
          img.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        } else {
          img.src = url;
        }
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } else {
              reject(new Error('Canvas context not available'));
            }
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = (err) => reject(err);
      });
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const terminalName = selectedTerminalId === 'all' ? 'Todos os Terminais' : terminalsList.find(t => t.id === selectedTerminalId)?.name || 'Todos';

    const fmtDate = (d: string) => {
      if (!d) return '';
      if (d.includes('-')) {
        const [y, m, d1] = d.split('-');
        return `${d1}/${m}`;
      }
      return d.slice(0, 5);
    };

    const startLabelHeader = startDate ? fmtDate(startDate) : new Date(selectedCampaign.created_at).toLocaleDateString('pt-BR');
    const endLabelHeader = endDate ? fmtDate(endDate) : dateStr;

    try {
      // 1. Header Branded Design (Logo top-left, corporate info top-right)
      let headerY = 28;
      if (profile?.logo_url) {
        try {
          const logoDataUri = await getBase64Image(profile.logo_url);
          // Calculate size
          const tempImg = new Image();
          tempImg.src = logoDataUri;
          await new Promise((res) => { tempImg.onload = res; });
          const aspect = tempImg.naturalWidth / tempImg.naturalHeight;
          let logoW = 45;
          let logoH = logoW / aspect;
          if (logoH > 18) {
            logoH = 18;
            logoW = logoH * aspect;
          }
          doc.addImage(logoDataUri, 'PNG', 15, 12, logoW, logoH, undefined, 'FAST');
        } catch (e) {
          console.warn('Could not load logo image for PDF rendering', e);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.setTextColor(50, 50, 50);
          doc.text(profile.empresa || 'Empresa', 15, 22);
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(50, 50, 50);
        doc.text(profile?.empresa || 'Empresa', 15, 22);
      }

      // Corporate Info Right
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text('beend.tech', pageWidth - 15, 15, { align: 'right' });
      doc.setFontSize(8);
      doc.text('Soluções Inteligentes em Feedback', pageWidth - 15, 19, { align: 'right' });
      doc.text(`Relatório gerado em ${dateStr} às ${timeStr}`, pageWidth - 15, 23, { align: 'right' });

      // Dividers
      doc.setDrawColor(210, 215, 220);
      doc.setLineWidth(0.3);
      doc.line(15, 33, pageWidth - 15, 33);

      // 2. Titles Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      const mainTitle = `Relatório Diário ${selectedCampaign.name.toUpperCase()} - ${endDate ? fmtDate(endDate) : dateStr}`;
      doc.text(mainTitle, pageWidth / 2, 42, { align: 'center' });

      doc.setFontSize(11);
      doc.text('Satisfação diária', pageWidth / 2, 48, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      const subInfo = `Terminal: ${terminalName}   |   Período: ${startLabelHeader} até ${endLabelHeader}`;
      doc.text(subInfo, pageWidth / 2, 53, { align: 'center' });

      doc.line(15, 57, pageWidth - 15, 57);

      let currentY = 65;

      // 3. Questions Loop - Ordered exactly as the Dashboard (all non-NPS first, then NPS at the end)
      const primaryQ = selectedCampaign.questions?.find((q: any) => ['NPS', 'SMILE 5', 'SMILE 4'].includes(q.type));
      const nonNpsQuestions = (selectedCampaign.questions || []).filter((q: any) => q.type !== 'NPS' && q.type !== 'Texto Aberto');
      const npsQuestion = (selectedCampaign.questions || []).find((q: any) => q.type === 'NPS');

      const categoricalColors = [
        [59, 130, 246], // Indigo/Blue
        [220, 38, 38],  // Red
        [13, 148, 136], // Teal
        [217, 119, 6],  // Amber
        [8, 145, 178],  // Cyan
        [75, 85, 99]    // Slate
      ];

      nonNpsQuestions.forEach((q: any, idx: number) => {
        // Render section title "Resumo de Opções" before the second question
        if (idx === 1) {
          if (currentY > 240) { doc.addPage(); currentY = 18; }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text("Resumo de Opções", 15, currentY);
          currentY += 8;
        }

        if (currentY > 230) { doc.addPage(); currentY = 18; }

        const qStats = getQuestionStats(q.text, q.type);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(0, 0, 0);

        const titleTextLines = doc.splitTextToSize(`${idx + 1}ª) ${q.text}`, pageWidth - 30);
        doc.text(titleTextLines, 15, currentY);
        currentY += (titleTextLines.length * 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);

        if (q.type === 'SMILE 5' || q.type === 'SMILE 4') {
          doc.text(`${qStats.respondentCount} respostas`, 15, currentY);
          currentY += 5;

          const boxY = currentY;
          const boxH = 34;

          // Single box (Satisfaction Score)
          doc.setFillColor(240, 248, 255); // soft cyan blue
          doc.roundedRect(15, boxY, 40, boxH, 2, 2, 'F');
          
          const scoreVal = qStats.satisfaction;
          drawLargeSmileyFace(doc, 35, boxY + 7.5, scoreVal);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(11, 130, 255); // brand blue
          doc.text("Satisfação", 35, boxY + 17, { align: 'center' });

          doc.setFontSize(18);
          doc.text(`${formatPercent(scoreVal)}%`, 35, boxY + 27, { align: 'center' });

          // Right Bars options distribution
          const optionsList = q.type === 'SMILE 5' ? [
            { label: "Muito satisfeito", count: qStats.distribution['MUITO SATISFEITO'] || 0, color: [34, 197, 93], smiley: 'happy' },
            { label: "Satisfeito", count: qStats.distribution['SATISFEITO'] || 0, color: [163, 230, 53], smiley: 'smile' },
            { label: "Regular", count: qStats.distribution['REGULAR'] || 0, color: [234, 179, 8], smiley: 'meh' },
            { label: "Insatisfeito", count: qStats.distribution['INSATISFEITO'] || 0, color: [249, 115, 22], smiley: 'sad' },
            { label: "Muito Insatisfeito", count: qStats.distribution['MUITO INSATISFEITO'] || 0, color: [239, 68, 68], smiley: 'angry' },
          ] : [
            { label: "Excelente", count: qStats.distribution['EXCELENTE'] || 0, color: [34, 197, 93], smiley: 'happy' },
            { label: "Bom", count: qStats.distribution['BOM'] || 0, color: [163, 230, 53], smiley: 'smile' },
            { label: "Regular", count: qStats.distribution['REGULAR'] || 0, color: [234, 179, 8], smiley: 'meh' },
            { label: "Ruim", count: qStats.distribution['RUIM'] || 0, color: [239, 68, 68], smiley: 'sad' },
          ];

          const optionPercs = calculatePercentages(optionsList.map(o => o.count));
          
          let rowY = boxY + (q.type === 'SMILE 4' ? 5 : 2.5);
          const rightLabelX = 62;
          const rightBarStartX = 98;
          const rightBarWidth = 60;

          optionsList.forEach((opt, oIdx) => {
            if (opt.smiley) {
              drawSmileyFace(doc, rightLabelX - 4, rowY + 1.5, opt.smiley);
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(50, 50, 50);
            doc.text(opt.label, rightLabelX, rowY + 3);

            // Progress background
            doc.setFillColor(242, 244, 246);
            doc.rect(rightBarStartX, rowY, rightBarWidth, 4, 'F');

            // Progress fill
            const ratio = qStats.count > 0 ? (opt.count / qStats.count) : 0;
            if (ratio > 0) {
              doc.setFillColor(opt.color[0], opt.color[1], opt.color[2]);
              doc.rect(rightBarStartX, rowY, rightBarWidth * ratio, 4, 'F');
            }

            // Counter details
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(80, 80, 80);
            doc.text(`${opt.count}  |  ${optionPercs[oIdx]}%`, 164, rowY + 3);

            rowY += 6;
          });

          currentY = boxY + boxH + 8;
        } else {
          // Categorical/Multi-choice question
          doc.text(`${qStats.respondentCount} respondentes   |   Seleção múltipla permitida`, 15, currentY);
          currentY += 4.5;

          const optionsToRender = (q.options || []).map((o: any) => ({
            label: o.text,
            count: qStats.distribution[String(o.text).toUpperCase()] || 0
          })).sort((a: any, b: any) => b.count - a.count);

          const innerPercs = calculatePercentages(optionsToRender.map((o: any) => o.count));

          optionsToRender.forEach((opt: any, oIdx: number) => {
            if (currentY > 270) { doc.addPage(); currentY = 18; }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);
            doc.text(opt.label, 15, currentY + 3);

            // Progress Bar
            const barStartX = 70;
            const barW = pageWidth - 15 - barStartX - 35;
            doc.setFillColor(242, 244, 246);
            doc.rect(barStartX, currentY, barW, 4, 'F');

            const ratio = qStats.respondentCount > 0 ? (opt.count / qStats.respondentCount) : 0;
            if (ratio > 0) {
              const col = categoricalColors[oIdx % categoricalColors.length];
              doc.setFillColor(col[0], col[1], col[2]);
              doc.rect(barStartX, currentY, barW * ratio, 4, 'F');
            }

            doc.setFontSize(7.5);
            doc.setTextColor(80, 80, 80);
            doc.text(`${opt.count}  |  ${innerPercs[oIdx]}%`, pageWidth - 40, currentY + 3);

            currentY += 6.5;
          });

          currentY += 6;
        }
      });

      // Render NPS question at the end if exists
      if (npsQuestion) {
        if (currentY + 45 > 280) { doc.addPage(); currentY = 18; }
        else { currentY += 5; }

        const qStats = getQuestionStats(npsQuestion.text, npsQuestion.type);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(0, 0, 0);
        doc.text("NPS (NET PROMOTER SCORE)", 15, currentY);
        currentY += 5;

        const titleTextLines = doc.splitTextToSize(npsQuestion.text, pageWidth - 30);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(titleTextLines, 15, currentY);
        currentY += (titleTextLines.length * 4.5);

        // Compute NPS statistics dynamically from responses for this question
        const npsResponses = responses.map(r => {
          let parsed = [];
          try {
            parsed = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
          } catch (e) {}
          const ansObj = (parsed || []).find((a: any) => String(a.question || '').trim().toLowerCase() === String(npsQuestion.text || '').trim().toLowerCase());
          return ansObj && ansObj.answer !== null && ansObj.answer !== undefined && ansObj.answer !== '' ? Number(ansObj.answer) : null;
        }).filter((val): val is number => val !== null && !isNaN(val));

        const promCount = npsResponses.filter(v => v >= 9).length;
        const neuCount = npsResponses.filter(v => v >= 7 && v <= 8).length;
        const detCount = npsResponses.filter(v => v >= 0 && v <= 6).length;
        const totCount = npsResponses.length;
        const scoreNps = totCount > 0 ? ((promCount - detCount) / totCount) * 100 : 0;

        const boxY = currentY;
        const boxH = 26;

        // Box (NPS Score)
        doc.setFillColor(240, 248, 255); // soft cyan blue
        doc.roundedRect(15, boxY, 40, boxH, 2, 2, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(11, 130, 255); // brand blue
        doc.text("SCORE NPS", 35, boxY + 10, { align: 'center' });

        doc.setFontSize(16);
        doc.text(`${formatPercent(scoreNps)}`, 35, boxY + 20, { align: 'center' });

        // Right Bars (Promoters, Neutrals, Detractors)
        const optionsList = [
          { label: "Promotores (9-10)", count: promCount, color: [34, 197, 93], smiley: 'happy' },
          { label: "Neutros (7-8)", count: neuCount, color: [234, 179, 8], smiley: 'meh' },
          { label: "Detratores (0-6)", count: detCount, color: [239, 68, 68], smiley: 'sad' },
        ];

        const optionPercs = calculatePercentages(optionsList.map(o => o.count));
        
        let rowY = boxY + 2;
        const rightLabelX = 62;
        const rightBarStartX = 98;
        const rightBarWidth = 60;

        optionsList.forEach((opt, oIdx) => {
          if (opt.smiley) {
            drawSmileyFace(doc, rightLabelX - 4, rowY + 1.5, opt.smiley);
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          doc.text(opt.label, rightLabelX, rowY + 3);

          // Progress background
          doc.setFillColor(242, 244, 246);
          doc.rect(rightBarStartX, rowY, rightBarWidth, 4, 'F');

          // Progress fill
          const ratio = totCount > 0 ? (opt.count / totCount) : 0;
          if (ratio > 0) {
            doc.setFillColor(opt.color[0], opt.color[1], opt.color[2]);
            doc.rect(rightBarStartX, rowY, rightBarWidth * ratio, 4, 'F');
          }

          // Counter details
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(80, 80, 80);
          doc.text(`${opt.count}  |  ${optionPercs[oIdx]}%`, 164, rowY + 3);

          rowY += 6.5;
        });

        currentY = boxY + boxH + 8;
      }

      // 5. Line Chart (Evolução dos últimos 12 dias)
      if (currentY > 175) { doc.addPage(); currentY = 20; }
      else { currentY += 5; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Evolução dos últimos 12 dias", 15, currentY);
      currentY += 5;

      if (primaryQ) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`1. ${primaryQ.text}`, 15, currentY);
        currentY += 4.5;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`${responses.length} respostas no período filtrado`, 15, currentY);
      currentY += 12;

      // Logic to calculate satisfaction for a set of responses
      const getSatisfactionForResponses = (dayResponses: any[]) => {
        if (dayResponses.length === 0 || !primaryQ) return 0;
        
        let relevantAnswers: any[] = [];
        dayResponses.forEach(r => {
          let parsedAnswers = [];
          if (typeof r.answers === 'string') {
            try { parsedAnswers = JSON.parse(r.answers); } catch (e) {}
          } else if (Array.isArray(r.answers)) {
            parsedAnswers = r.answers;
          }
          const qAnswers = parsedAnswers.filter((a: any) => String(a.question).trim().toLowerCase() === String(primaryQ.text).trim().toLowerCase()).map((a: any) => a.answer);
          qAnswers.forEach(ans => {
            if (Array.isArray(ans)) relevantAnswers.push(...ans);
            else if (ans !== null && ans !== undefined) relevantAnswers.push(ans);
          });
        });

        if (relevantAnswers.length === 0) return 0;

        if (primaryQ.type === 'NPS') {
          let promotores = 0;
          let detratores = 0;
          let npsCount = 0;
          relevantAnswers.forEach(ans => {
            const val = Number(ans);
            if (!isNaN(val)) {
              npsCount++;
              if (val >= 9) promotores++;
              else if (val <= 6) detratores++;
            }
          });
          return npsCount > 0 ? ((promotores - detratores) / npsCount) * 100 : 0;
        } else {
          let scoreValue = 0;
          relevantAnswers.forEach(ans => {
            const val = String(ans).toUpperCase();
            if (['MUITO SATISFEITO', 'EXCELENTE', 'MUITO BOM'].includes(val)) scoreValue += 100;
            else if (['SATISFEITO', 'BOM'].includes(val)) scoreValue += 75;
            else if (['REGULAR'].includes(val)) scoreValue += 50;
            else if (['RUIM', 'PÉSSIMO', 'INSATISFEITO', 'MUITO INSATISFEITO'].includes(val)) scoreValue += 25;
          });
          return scoreValue / relevantAnswers.length;
        }
      };

      // Draw 12 calendar days trend chart
      const maxDate = responses.length > 0
        ? new Date(Math.max(...responses.map(r => new Date(r.created_at).getTime())))
        : new Date();
      
      const last12Days: { dateStr: string; label: string; weekday: string; dateShort: string }[] = [];
      const daysWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(maxDate);
        d.setDate(d.getDate() - i);
        const dayLabel = daysWeek[d.getDay()];
        const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const key = d.toISOString().split('T')[0];
        last12Days.push({
          dateStr: key,
          label: `${dayLabel}\n${dateLabel}`,
          weekday: dayLabel,
          dateShort: dateLabel
        });
      }

      const chartPoints = last12Days.map((daySpec, idx) => {
        const dayResponses = responses.filter(r => {
          const datePart = new Date(r.created_at).toISOString().split('T')[0];
          return datePart === daySpec.dateStr;
        });
        const hasResponses = dayResponses.length > 0;
        const val = hasResponses ? getSatisfactionForResponses(dayResponses) : 0;
        return {
          ...daySpec,
          idx,
          hasResponses,
          v: val
        };
      });

      const activePoints = chartPoints.filter(p => p.hasResponses);

      const ch = 40;
      const cw = pageWidth - 40;
      const cx = 22;
      const cy = currentY;

      // Draw Grid Y Ticks
      doc.setDrawColor(240, 242, 245);
      doc.setLineWidth(0.15);
      [0, 0.25, 0.5, 0.75, 1].forEach(tick => {
        const ty = cy + ch - (tick * ch);
        doc.line(cx, ty, cx + cw - 12, ty);
        doc.setFontSize(6.5);
        doc.setTextColor(150, 150, 150);
        doc.text(`${Math.round(tick * 100)}%`, cx - 2, ty + 0.8, { align: 'right' });
      });

      // Plot Line
      doc.setDrawColor(44, 125, 230); // beautiful Dodger Blue line
      doc.setLineWidth(0.8);
      
      chartPoints.forEach((pt, idx) => {
        const xPos = cx + (pt.idx * ((cw - 15) / 11));
        const yPercent = Math.min(Math.max(pt.v / 100, 0), 1);
        const yPos = cy + ch - (yPercent * ch);

        if (idx > 0) {
          const prevPt = chartPoints[idx - 1];
          const prevX = cx + (prevPt.idx * ((cw - 15) / 11));
          const prevPercent = Math.min(Math.max(prevPt.v / 100, 0), 1);
          const prevY = cy + ch - (prevPercent * ch);
          doc.line(prevX, prevY, xPos, yPos);
        }
      });

      // Draw Dots and Values over line for all points
      chartPoints.forEach((pt) => {
        const xPos = cx + (pt.idx * ((cw - 15) / 11));
        const yPercent = Math.min(Math.max(pt.v / 100, 0), 1);
        const yPos = cy + ch - (yPercent * ch);

        doc.setFillColor(44, 125, 230);
        doc.circle(xPos, yPos, 0.9, 'F');

        // Draw percentage value above dot
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(60, 60, 60);
        doc.text(`${formatPercent(pt.v)}%`, xPos, yPos - 2.2, { align: 'center' });
      });

      // Draw day labels underneath x-axis for ALL 12 days to key the timeline
      chartPoints.forEach((pt) => {
        const xPos = cx + (pt.idx * ((cw - 15) / 11));
        doc.setFontSize(6.5);
        doc.setTextColor(140, 140, 140);
        doc.text(pt.weekday, xPos, cy + ch + 4, { align: 'center' });
        doc.text(pt.dateShort, xPos, cy + ch + 8, { align: 'center' });
      });

      currentY += ch + 15;

      // 6. Comments / Textual feedbacks beautifully grouped by Question
      const feedbackGroups: Record<string, { question: string; comments: { dateStr: string; rating: string; comment: string }[] }> = {};
      
      responses.forEach(r => {
        let parsed: any[] = [];
        try {
          parsed = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
        } catch (e) {
          console.warn(e);
        }
        
        let ratingText = '';
        if (primaryQ) {
          const ratingAns = parsed.find((a: any) => a.question === primaryQ.text);
          if (ratingAns) {
            ratingText = String(ratingAns.answer);
          }
        }
        
        parsed.forEach((ans: any) => {
          const commentVal = ans.comment ? String(ans.comment).trim() : '';
          const isTextOpen = selectedCampaign?.questions?.find((cq: any) => cq.text === ans.question)?.type === 'Texto Aberto';
          const realText = isTextOpen ? String(ans.answer).trim() : commentVal;
          
          if (realText && realText.length > 0) {
            if (!feedbackGroups[ans.question]) {
              feedbackGroups[ans.question] = { question: ans.question, comments: [] };
            }
            
            const localFormattedTime = new Date(r.created_at).toLocaleDateString('pt-BR') + ' às ' + new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            feedbackGroups[ans.question].comments.push({
              dateStr: localFormattedTime,
              rating: ratingText || 'N/A',
              comment: realText
            });
          }
        });
      });

      const questionKeysWithComments = Object.keys(feedbackGroups);
      if (questionKeysWithComments.length > 0) {
        doc.addPage();
        currentY = 20;

        questionKeysWithComments.forEach((qKey, qkIdx) => {
          const fGroup = feedbackGroups[qKey];
          if (currentY > 230) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text(`Comentários - ${fGroup.question}`, 15, currentY);
          currentY += 5;

          const tableData = fGroup.comments.map(c => [
            c.dateStr,
            c.rating,
            c.comment
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [[
              'Horário',
              primaryQ ? primaryQ.text : 'Avaliação',
              'Comentário ou Sugestão'
            ]],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { cellWidth: 40 },
              2: { cellWidth: 'auto' }
            }
          });

          // @ts-ignore
          currentY = doc.lastAutoTable.finalY + 12;
        });
      }

      doc.save(`Relatorio-${selectedCampaign.name.toUpperCase().replace(/\s+/g, '-')}-${now.getTime()}.pdf`);
      toast.success('Relatório gerado!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar relatório PDF.');
    }
  };

  const npsMetrics = [
    { label: 'Detratores', value: topDetratores, subtext: `${topDetratores}/${topTotalEngagement} participações`, color: '#e74b3c', icon: Frown },
    { label: 'Neutros', value: topNeutros, subtext: `${topNeutros}/${topTotalEngagement} participações`, color: '#f1c40f', icon: Meh },
    { label: 'Promotores', value: topPromotores, subtext: `${topPromotores}/${topTotalEngagement} participações`, color: '#4cc077', icon: Smile },
    { label: 'Sua Nota', value: topScore, subtext: 'Resultado Final', color: '#2b80b9', icon: Trophy },
  ];

  const reportHandlerRef = useRef<any>(null);
  useEffect(() => { reportHandlerRef.current = handleGerarRelatorio; });
  useEffect(() => {
    const listener = () => { if (reportHandlerRef.current) reportHandlerRef.current(); };
    window.addEventListener('generate-report', listener);
    return () => window.removeEventListener('generate-report', listener);
  }, []);


  const evolutionData = selectedCampaign ? [
    { name: new Date(selectedCampaign.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), satisfaction: currentSatisfaction, prevSatisfaction: 0 },
    { name: 'Hoje', satisfaction: currentSatisfaction, prevSatisfaction: 0 }
  ] : [
    { name: 'Início', satisfaction: 0, prevSatisfaction: 0 },
    { name: 'Hoje', satisfaction: 0, prevSatisfaction: 0 }
  ];

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {selectedCampaign?.questions?.some((q: any) => q.type === 'NPS') && (
            <div className={`mt-8 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'}`}>
              <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <h2 className={`text-xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Nota do NPS (Net Promoter Score)</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {npsMetrics.map((metric) => (
                    <div 
                      key={metric.label}
                      className="rounded-md p-3 flex flex-col items-center justify-center text-center text-white space-y-0.5 shadow-sm"
                      style={{ backgroundColor: metric.color }}
                    >
                      {metric.label === 'Sua Nota' ? (
                        <metric.icon size={32} strokeWidth={1.5} />
                      ) : (
                        <metric.icon size={32} strokeWidth={2.5} stroke={metric.color} fill="white" className="opacity-95" />
                      )}
                      <span className="text-4xl font-black">{metric.label === 'Sua Nota' ? formatPercent(metric.value) : metric.value}</span>
                      <span className="text-sm font-bold tracking-wide uppercase leading-none">{metric.label}</span>
                      <span className="text-[10px] opacity-80 leading-tight font-medium">{metric.subtext}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div
            className={`mt-8 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'}`}
          >
            <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <h2 className={`text-xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Filtros de Pesquisa</h2>
            </div>
            <div className={`px-6 py-4 border-b flex flex-wrap items-center gap-2 transition-colors ${
              isDarkMode ? 'bg-black/50 border-white/5' : 'bg-slate-50/50 border-slate-100'
            }`}>
              <span className={`text-[10px] font-black uppercase tracking-widest self-center mr-2 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Atalhos:</span>
              <div className="flex flex-wrap gap-2 flex-1">
                {[7, 30, 90, 120].map(days => (
                  <button
                    key={days}
                    onClick={() => setQuickRange(days)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer shadow-sm active:scale-95 ${
                      activeShortcut === days 
                        ? 'bg-[#0b82ff] text-white border border-[#0b82ff]' 
                        : (isDarkMode ? 'bg-zinc-800 border-white/10 text-zinc-400 hover:bg-zinc-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100')
                    }`}
                  >
                    Últimos {days} Dias
                  </button>
                ))}
              </div>

              {(startDate || endDate || selectedTerminalId !== 'all') && (
                <button
                  onClick={clearFilters}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 ${
                    isDarkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <X size={12} strokeWidth={3} />
                  Limpar Filtros
                </button>
              )}
            </div>
            <div className="p-6 flex flex-wrap lg:grid lg:grid-cols-5 items-end gap-4">
              <div className="flex flex-col space-y-1.5 min-w-[140px] flex-1 lg:flex-none">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Inicial:</label>
                 <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full border rounded-md px-2 py-2 text-sm outline-none h-10 transition-colors ${
                    isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-[#f8fafb] border-slate-200 text-slate-600 focus:border-slate-400'
                  }`}
                />
              </div>
              <div className="flex flex-col space-y-1.5 min-w-[140px] flex-1 lg:flex-none">
                <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Data Final:</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full border rounded-md px-2 py-2 text-sm outline-none h-10 transition-colors ${
                    isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-[#f8fafb] border-slate-200 text-slate-600 focus:border-slate-400'
                  }`}
                />
              </div>

              <div className="flex flex-col space-y-1.5 min-w-[160px] flex-1 lg:flex-none">
                <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Terminal:</label>
                <select 
                  disabled={isTerminal}
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                  className={`w-full border rounded-md px-2 py-2 text-sm outline-none appearance-none h-10 transition-colors ${
                    isTerminal ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-[#f8fafb] border-slate-200 text-slate-600 focus:border-slate-400'
                  }`}
                >
                  {!isTerminal && <option value="all">Todos os terminais</option>}
                  {terminalsList.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1.5 w-full lg:w-auto">
                <label className="hidden lg:block text-[10px] font-bold text-slate-400 tracking-widest opacity-0">Relatório:</label>
                <button 
                  onClick={handleGerarRelatorio}
                  className="flex items-center justify-center space-x-2 w-full lg:px-4 h-10 rounded-md text-white font-bold text-sm bg-[#0b82ff] hover:opacity-90 transition-all shadow-md active:scale-95 group cursor-pointer"
                >
                  <FileText size={14} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="whitespace-nowrap uppercase">Gerar Relatório</span>
                </button>
              </div>

              <div className="flex flex-col space-y-1.5 w-full lg:w-auto">
                <label className="hidden lg:block text-[10px] font-bold text-slate-400 tracking-widest opacity-0">Exportar:</label>
                <button 
                  onClick={handleExportConsolidado}
                  className="flex items-center justify-center space-x-2 w-full lg:px-4 h-10 rounded-md text-white font-bold text-sm bg-[#2b80b9] hover:opacity-90 transition-all shadow-md active:scale-95 group cursor-pointer"
                >
                  <Download size={14} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="whitespace-nowrap uppercase">Exportar CSV</span>
                </button>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex flex-col md:flex-row justify-between items-end gap-6 transition-colors"
          >
            <div className="space-y-1">
              <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Nome da campanha:</p>
              <h3 className={`text-4xl font-black tracking-tight uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedCampaign ? selectedCampaign.name : 'Nenhuma campanha'}</h3>
            </div>

            <div className="flex flex-col space-y-2 w-full md:w-auto md:min-w-[300px]">
              <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Visualizar outra campanha:</label>
              <div className="flex flex-col space-y-1">
                <span className={`text-[11px] font-medium ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Selecione uma campanha:</span>
                <select 
                  className={`w-full border rounded-md px-3 py-2 text-base outline-none appearance-none h-10 cursor-pointer transition-all ${
                    isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500 hover:border-white/20' : 'bg-white border-slate-200 text-slate-600 focus:border-slate-400 hover:border-slate-300'
                  }`}
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                >
                  {campaigns.map(camp => (
                    <option key={camp.id} value={camp.id}>{camp.name}</option>
                  ))}
                  {campaigns.length === 0 && <option value="">Nenhuma campanha disponível</option>}
                </select>
              </div>
            </div>
          </motion.div>

          {(() => {
            const hasNps = selectedCampaign?.questions?.some((q: any) => q.type === 'NPS');
            const nonNpsQuestions = (selectedCampaign?.questions || []).filter((q: any) => q.type !== 'NPS' && q.type !== 'Texto Aberto');
            const npsQuestion = (selectedCampaign?.questions || []).find((q: any) => q.type === 'NPS');
            const npsQuestionText = npsQuestion?.text || "Resumo das avaliações coletadas para esta pergunta.";
            const totalItems = nonNpsQuestions.length + (hasNps ? 1 : 0);
            return (
              <div className={`mt-8 grid gap-6 ${
                totalItems === 1 ? 'grid-cols-1' :
                totalItems === 2 ? 'grid-cols-1 md:grid-cols-2' :
                totalItems === 3 ? 'grid-cols-1 md:grid-cols-3' :
                'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
              }`}>
                {nonNpsQuestions.map((q: any, idx: number) => {
                  const stats = getQuestionStats(q.text, q.type);
                  const totalQResponses = stats.count; // Total number of individual selections
                  const totalQEngagement = stats.respondentCount; // Total number of users who answered
                  
                  const options = q.type === 'SMILE 5' ? [
                    { label: "Muito satisfeito", count: stats.distribution['MUITO SATISFEITO'] || 0, color: "#22c55d", icon: Laugh },
                    { label: "satisfeito", count: stats.distribution['SATISFEITO'] || 0, color: "#84cc15", icon: Smile },
                    { label: "regular", count: stats.distribution['REGULAR'] || 0, color: "#e9b306", icon: Meh },
                    { label: "insatisfeito", count: stats.distribution['INSATISFEITO'] || 0, color: "#f97316", icon: Frown },
                    { label: "Muito Insatisfeito", count: stats.distribution['MUITO INSATISFEITO'] || 0, color: "#ef4444", icon: Angry },
                  ] : q.type === 'SMILE 4' ? [
                    { label: "EXCELENTE", count: stats.distribution['EXCELENTE'] || 0, color: "#22c55d", icon: Laugh },
                    { label: "BOM", count: stats.distribution['BOM'] || 0, color: "#84cc15", icon: Smile },
                    { label: "REGULAR", count: stats.distribution['REGULAR'] || 0, color: "#e9b306", icon: Meh },
                    { label: "RUIM", count: stats.distribution['RUIM'] || 0, color: "#ef4444", icon: Frown },
                  ] : (q.options || []).map((opt: any) => {
                    const optVal = opt.text.toUpperCase();
                    return {
                      label: opt.text,
                      count: stats.distribution[optVal] || 0,
                      color: opt.color || '#3b82f6',
                      image: opt.image
                    };
                  });
                  
                  // Compute percentages
                  const qOptionPercsUI = calculatePercentages(options.map((o: any) => o.count));
                  options.forEach((opt: any, oIdx: number) => {
                    opt.formattedPercentage = qOptionPercsUI[oIdx];
                  });

                  return (
                    <motion.div
                      key={q.id || idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        delay: 0.6 + (idx * 0.1),
                        scale: { duration: 0.1 },
                        y: { duration: 0.1 }
                      }}
                      whileHover={{ y: -5, scale: 1.02 }}
                      className={`rounded-md p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col cursor-pointer group border-b-0 hover:border-b-[5px] hover:border-[#0b82ff] relative transition-colors ${
                        isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6 pr-2">
                        <h4 className={`text-sm font-bold leading-tight pr-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {idx + 1}ª) {q.text}
                        </h4>
                        {['SMILE 5', 'SMILE 4'].includes(q.type) && (
                          <div className="flex flex-col items-end">
                             <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Satisfação</span>
                             <span className="text-sm font-black text-green-500">{formatPercent(stats.satisfaction)}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        {options.map((opt: any, oIdx: number) => (
                          <div key={oIdx} className="space-y-1">
                            <div className="flex justify-between items-end text-xs font-bold">
                              <div className={`flex items-center gap-1.5 uppercase ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                                {opt.icon && <opt.icon size={14} strokeWidth={3} style={{ color: opt.color }} />}
                                {opt.image && <img src={opt.image} alt={opt.label} className={`w-8 h-8 rounded-full object-cover border ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`} referrerPolicy="no-referrer" />}
                                <span>{opt.label}</span>
                              </div>
                              <span className={isDarkMode ? 'text-zinc-300' : 'text-slate-700'}>({opt.count}) {opt.formattedPercentage}%</span>
                            </div>
                            <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-slate-100'}`}>
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(totalQResponses > 0 ? (opt.count / totalQResponses) * 100 : 0)}%` }}
                                transition={{ duration: 1, delay: 1 + (idx * 0.1) + (oIdx * 0.1) }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: opt.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={`mt-8 pt-4 border-t flex justify-between items-center ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                        <span className="text-xs font-bold text-[#2b80b9] uppercase tracking-widest">Engajamento</span>
                        <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>({totalQEngagement})</span>
                      </div>
                    </motion.div>
                  );
                })}

                {hasNps && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: 0.9,
                      scale: { duration: 0.1 },
                      y: { duration: 0.1 }
                    }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className={`rounded-md p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col cursor-pointer group border-b-0 hover:border-b-[5px] hover:border-[#2b80b9] transition-colors ${
                      isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'
                    }`}
                  >
                    {(() => {
                      const npsStats = getQuestionStats(npsQuestion?.text || '', 'NPS');
                      const totalNpsEngagement = npsStats.respondentCount;
                      
                      // Calculate Promotores (9-10), Neutros (7-8), Detratores (0-6)
                      let promotores = 0;
                      let neutros = 0;
                      let detratores = 0;

                      responses.forEach(r => {
                        let parsed = [];
                        if (typeof r.answers === 'string') {
                          try { parsed = JSON.parse(r.answers); } catch (e) {}
                        } else if (Array.isArray(r.answers)) {
                          parsed = r.answers;
                        }

                        const npsAnswer = parsed.find((a: any) => a.question === npsQuestion?.text)?.answer;
                        if (npsAnswer !== undefined && npsAnswer !== null) {
                          const val = Number(npsAnswer);
                          if (!isNaN(val)) {
                            if (val >= 9) promotores++;
                            else if (val >= 7) neutros++;
                            else detratores++;
                          }
                        }
                      });

                      const npsScoreRaw = totalNpsEngagement > 0 ? (((promotores - detratores) / totalNpsEngagement) * 100) : 0;
                      const npsScore = formatPercent(npsScoreRaw);
                      const npsOptionPercsUI = calculatePercentages([promotores, neutros, detratores]);

                      return (
                        <>
                          <div className="mb-2">
                            <h4 className="text-sm font-black text-[#2b80b9] uppercase tracking-wider">NPS (NET PROMOTER SCORE)</h4>
                            <p className={`text-xs leading-tight mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                              {npsQuestionText}
                            </p>
                          </div>
                          
                          <div className="my-4 text-center">
                            <p className={`text-xs font-bold uppercase ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Sua pontuação é:</p>
                            <p className="text-5xl font-black text-[#2b80b9]">{npsScore}</p>
                          </div>

                          <div className="flex-1 space-y-4">
                            {[
                              { label: "Promotores", count: promotores, percentage: npsOptionPercsUI[0], color: "#4cc077", icon: Laugh, rawPerc: totalNpsEngagement > 0 ? (promotores / totalNpsEngagement) * 100 : 0 },
                              { label: "Neutros", count: neutros, percentage: npsOptionPercsUI[1], color: "#f1c40f", icon: Meh, rawPerc: totalNpsEngagement > 0 ? (neutros / totalNpsEngagement) * 100 : 0 },
                              { label: "Detratores", count: detratores, percentage: npsOptionPercsUI[2], color: "#e74b3c", icon: Frown, rawPerc: totalNpsEngagement > 0 ? (detratores / totalNpsEngagement) * 100 : 0 },
                            ].map((opt, oIdx) => (
                              <div key={oIdx} className="space-y-1">
                                <div className="flex justify-between items-end text-xs font-bold">
                                  <div className={`flex items-center gap-1.5 uppercase ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                                    {opt.icon && <opt.icon size={14} strokeWidth={3} style={{ color: opt.color }} />}
                                    <span>{opt.count} - {opt.label}</span>
                                  </div>
                                  <span className={isDarkMode ? 'text-zinc-300' : 'text-slate-700'}>{opt.percentage}%</span>
                                </div>
                                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-slate-100'}`}>
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${opt.rawPerc}%` }}
                                    transition={{ duration: 1, delay: 1.2 + (oIdx * 0.1) }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: opt.color }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className={`mt-8 pt-4 border-t flex justify-between items-center ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                            <span className="text-xs font-bold text-[#2b80b9] uppercase tracking-widest">Engajamento</span>
                            <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>({totalNpsEngagement})</span>
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                )}
              </div>
            );
          })()}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-12 w-full"
          >
            <div className="flex items-center space-x-3 mb-6">
              <TrendingUp className="text-[#22c55d]" size={24} />
              <h3 className={`text-xl font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>EVOLUÇÃO DE SATISFAÇÃO</h3>
            </div>
            
            <div className="h-[350px] w-full pt-4 relative">
              <ResponsiveContainer width="99%" height="100%">
                <AreaChart
                  data={evolutionData}
                  margin={{ top: 30, right: 20, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55d" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#22c55d" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#d1d5db'} opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: isDarkMode ? '#71717a' : '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 100]}
                    tick={{ fill: isDarkMode ? '#71717a' : '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${formatPercent(value)}%`, 
                      name === 'satisfaction' ? 'Semana atual' : 'Semana anterior'
                    ]}
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#18181b' : '#fff', 
                      borderRadius: '8px', 
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: isDarkMode ? '#fff' : '#000',
                      textTransform: 'uppercase'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="prevSatisfaction" 
                    stroke="#cbd5e1" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1} 
                    fill="url(#colorPrev)" 
                    animationDuration={2000}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="satisfaction" 
                    stroke="#22c55d" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    animationDuration={2000}
                  >
                    <LabelList 
                      dataKey="satisfaction" 
                      position="top" 
                      offset={15}
                      formatter={(value: number) => `${formatPercent(value)}%`}
                      style={{ fill: '#166534', fontSize: 11, fontWeight: 900 }}
                    />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
