import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { 
  Trophy, 
  Frown, 
  Meh, 
  Smile, 
  Download, 
  TrendingUp, 
  FileText, 
  Laugh, 
  Angry, 
  ShieldCheck, 
  Loader2, 
  ArrowRight,
  Users,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

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

export default function SecureReport() {
  const { token: urlToken } = useParams();
  const [token, setToken] = useState(urlToken || '');
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(!!urlToken);
  const [reportData, setReportData] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [evolution, setEvolution] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stats are now provided by the server through reportData.metrics
  const npsData = (reportData?.metrics?.nps && campaign?.questions) ? {
    ...reportData.metrics.nps,
    question: campaign?.questions?.find((q: any) => q.type === 'NPS')
  } : null;

  const currentSatisfaction = reportData?.metrics?.overallSatisfaction || 0;

  const getQuestionStatsFromServer = (qText: string) => {
    const normalized = String(qText || '').trim().toLowerCase();
    return reportData?.metrics?.questionStats?.find((s: any) => String(s.text || '').trim().toLowerCase() === normalized) || { count: 0, distribution: {}, average: 0 };
  };

  const processEvolutionData = () => {
    const daysWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const maxDate = new Date();
    const last7Days: any[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - i);
      const dayLabel = daysWeek[d.getDay()];
      const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      last7Days.push({
        dateStr: dateLabel, // e.g. "20/05"
        label: `${dayLabel}\n${dateLabel}`,
        weekday: dayLabel,
        dateShort: dateLabel
      });
    }

    const groups: Record<string, any[]> = {};
    if (evolution && evolution.length > 0) {
      evolution.forEach(r => {
        const day = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!groups[day]) groups[day] = [];
        groups[day].push(r);
      });
    }

    return last7Days.map((daySpec, idx) => {
      const dayResponses = groups[daySpec.dateStr] || [];
      const hasResponses = dayResponses.length > 0;
      
      let dayScore = 0;
      const primaryQ = campaign?.questions?.find((q: any) => ['NPS', 'SMILE 5', 'SMILE 4'].includes(q.type));
      
      if (hasResponses && primaryQ) {
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

        if (relevantAnswers.length > 0) {
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
            if (npsCount > 0) {
              dayScore = ((promotores - detratores) / npsCount) * 100;
            }
          } else {
            let scoreValue = 0;
            relevantAnswers.forEach(ans => {
              const val = String(ans).toUpperCase();
              if (['MUITO SATISFEITO', 'EXCELENTE', 'MUITO BOM'].includes(val)) scoreValue += 100;
              else if (['SATISFEITO', 'BOM'].includes(val)) scoreValue += 75;
              else if (['REGULAR'].includes(val)) scoreValue += 50;
              else if (['RUIM', 'PÉSSIMO', 'INSATISFEITO', 'MUITO INSATISFEITO'].includes(val)) scoreValue += 25;
            });
            dayScore = scoreValue / relevantAnswers.length;
          }
        }
      }

      return {
        ...daySpec,
        n: daySpec.dateShort,
        idx,
        hasResponses,
        v: dayScore
      };
    });
  };

  const formatPercent = (val: number) => {
    return val.toFixed(2).replace('.', ',');
  };

  const calculatePercentages = (counts: number[]) => {
    const cleanCounts = counts.map(c => Number(c) || 0);
    const total = cleanCounts.reduce((a, b) => a + b, 0);
    if (total === 0) return counts.map(() => "0,00");
    const basisPoints = cleanCounts.map(c => Math.round((c / total) * 10000));
    let sum = basisPoints.reduce((a, b) => a + b, 0);
    let diff = 10000 - sum;
    if (diff !== 0) {
      const maxVal = Math.max(...cleanCounts);
      const maxIndices = cleanCounts.map((c, i) => c === maxVal ? i : -1).filter(i => i !== -1);
      for (let i = 0; i < Math.abs(diff); i++) {
        const targetIdx = maxIndices[i % maxIndices.length];
        basisPoints[targetIdx] += (diff > 0 ? 1 : -1);
      }
    }
    return basisPoints.map(bp => (bp / 100).toFixed(2).replace('.', ','));
  };

  useEffect(() => {
    if (urlToken) {
      handleValidate(urlToken);
    }
  }, [urlToken]);

  const handleValidate = async (tokenToUse: string) => {
    if (!tokenToUse) return;
    setLoading(true);
    setError(null);
    setReportData(null);
    setCampaign(null);
    try {
      const res = await fetch(`/api/reports/check-token/${tokenToUse}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Token inválido.');

      setReportData(data);
      setCampaign(data.campaign);
      setProfile(data.profile || { empresa: 'Minha Empresa' });
      setResponses(data.responses || []);
      setEvolution(data.evolution || []);
      
      setIsValidating(false);
    } catch (err: any) {
      console.error('Erro na validação do relatório:', err);
      setError(err.message);
      toast.error(err.message);
      setIsValidating(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGerarRelatorio = async () => {
    if (!campaign) return;

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

    try {
      // 1. Header Branded Design (Logo top-left, corporate info top-right)
      if (profile?.logo_url) {
        try {
          const logoDataUri = await getBase64Image(profile.logo_url);
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
      doc.text('Relatório Seguro de Performance', pageWidth - 15, 19, { align: 'right' });
      doc.text(`Gerado em ${dateStr} às ${timeStr}`, pageWidth - 15, 23, { align: 'right' });

      // Dividers
      doc.setDrawColor(210, 215, 220);
      doc.setLineWidth(0.3);
      doc.line(15, 33, pageWidth - 15, 33);

      // 2. Titles Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      const titleText = `Relatório Seguro de Desempenho - ${campaign.name.toUpperCase()}`;
      doc.text(titleText, pageWidth / 2, 42, { align: 'center' });

      doc.setFontSize(11);
      doc.text('Satisfação diária', pageWidth / 2, 48, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      const refDate = reportData?.reference_date ? new Date(reportData.reference_date) : now;
      const refDateStr = refDate.toLocaleDateString('pt-BR');
      const referenceLabel = `Referência: ${refDateStr}   |   Emissão Segura: ${dateStr}`;
      doc.text(referenceLabel, pageWidth / 2, 53, { align: 'center' });

      doc.line(15, 57, pageWidth - 15, 57);

      let currentY = 65;

      if (reportData?.metrics?.totalResponses === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(239, 68, 68);
        doc.text('Nenhum registro encontrado para o dia de referência.', pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text('Possíveis causas: terminal offline, loja fechada ou campanha inativa.', pageWidth / 2, currentY, { align: 'center' });
        currentY += 20;
      }

      // 3. Questions Loop - Ordered exactly as the Dashboard (all non-NPS first, then NPS at the end)
      const primaryQ = campaign?.questions?.find((q: any) => ['NPS', 'SMILE 5', 'SMILE 4'].includes(q.type));
      const nonNpsQuestions = (campaign.questions || []).filter((q: any) => q.type !== 'NPS' && q.type !== 'Texto Aberto');
      const npsQuestion = (campaign.questions || []).find((q: any) => q.type === 'NPS');

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

        const qStats = getQuestionStatsFromServer(q.text);

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
          doc.text(`${qStats.count} respostas`, 15, currentY);
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
          doc.text(`${qStats.count} respondentes   |   Seleção múltipla permitida`, 15, currentY);
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

            const ratio = qStats.count > 0 ? (opt.count / qStats.count) : 0;
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

        const qStats = getQuestionStatsFromServer(npsQuestion.text);

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

      // 5. Line Chart (Evolução de Satisfação)
      if (currentY > 175) { doc.addPage(); currentY = 20; }
      else { currentY += 5; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Evolução dos últimos dias", 15, currentY);
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
      doc.text(`${responses.length} respostas registradas no período`, 15, currentY);
      currentY += 12;

      // Draw chronological sorted trend chart
      const evolData = processEvolutionData();
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
      
      evolData.forEach((pt, idx) => {
        const xPos = cx + (pt.idx * ((cw - 15) / 6));
        const yPercent = Math.min(Math.max((pt.v || 0) / 100, 0), 1);
        const yPos = cy + ch - (yPercent * ch);

        if (idx > 0) {
          const prevPt = evolData[idx - 1];
          const prevX = cx + (prevPt.idx * ((cw - 15) / 6));
          const prevPercent = Math.min(Math.max((prevPt.v || 0) / 100, 0), 1);
          const prevY = cy + ch - (prevPercent * ch);
          doc.line(prevX, prevY, xPos, yPos);
        }
      });

      // Draw Dots and Values over line for all points
      evolData.forEach((pt) => {
        const xPos = cx + (pt.idx * ((cw - 15) / 6));
        const yPercent = Math.min(Math.max((pt.v || 0) / 100, 0), 1);
        const yPos = cy + ch - (yPercent * ch);

        doc.setFillColor(44, 125, 230);
        doc.circle(xPos, yPos, 0.9, 'F');

        // Draw percentage value above dot
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(60, 60, 60);
        doc.text(`${formatPercent(pt.v || 0)}%`, xPos, yPos - 2.2, { align: 'center' });
      });

      // Draw day label underneath for all 7 days to keep the timeline
      evolData.forEach((pt) => {
        const xPos = cx + (pt.idx * ((cw - 15) / 6));
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
          const isTextOpen = campaign.questions?.find((cq: any) => cq.text === ans.question)?.type === 'Texto Aberto';
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

      doc.save(`Relatorio-Secure-${campaign.name.toUpperCase().replace(/\s+/g, '-')}-${now.getTime()}.pdf`);
      toast.success('Relatório gerado!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar relatório PDF.');
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#ecf0f1] flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Verificando Credenciais Seguras...</p>
        </div>
      </div>
    );
  }

  if (reportData && campaign) {
    const todayLabel = reportData?.reference_date
      ? new Date(reportData.reference_date).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    const npsMetrics = npsData ? [
      { label: 'Detratores', value: npsData.detratores, color: '#e74b3c', icon: Frown },
      { label: 'Neutros', value: npsData.neutros, color: '#f1c40f', icon: Meh },
      { label: 'Promotores', value: npsData.promotores, color: '#22c55d', icon: Smile },
      { label: 'Nota NPS', value: formatPercent(npsData.score), color: '#3b82f6', icon: Trophy },
    ] : [
      { label: 'Total Participações', value: responses.length, color: '#3b82f6', icon: Users },
      { label: 'Satisfação Média', value: formatPercent(currentSatisfaction), color: '#22c55d', icon: Trophy },
    ];

    return (
      <div className="min-h-screen bg-[#ecf0f1] p-6 md:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
              {profile?.logo_url && (
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                   <img src={profile.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <ShieldCheck className="text-blue-500" size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal Seguro beend.tech</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight uppercase leading-none">{campaign.name}</h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Desempenho do Dia ({todayLabel})</p>
              </div>
            </div>
            <button onClick={handleGerarRelatorio} className="flex items-center gap-2 px-8 py-4 bg-[#0b82ff] text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all cursor-pointer">
              <Download size={18} />
              Gerar Relatório PDF
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {npsMetrics.map((m) => (
              <div key={m.label} className="rounded-2xl p-6 flex flex-col items-center justify-center text-center text-white shadow-lg space-y-2" style={{ backgroundColor: m.color }}>
                <m.icon size={32} className="opacity-90" />
                <span className="text-4xl font-black">{m.value}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(campaign.questions || []).filter((q: any) => q.type !== 'NPS' && q.type !== 'Texto Aberto').map((q: any, idx: number) => {
                    const s = getQuestionStatsFromServer(q.text);
                    let options = [];
                    
                    if (q.type === 'SMILE 5') {
                        options = [
                            { label: "Muito satisfeito", count: s.distribution['MUITO SATISFEITO'] || 0, color: "#22c55d", icon: Laugh },
                            { label: "Satisfeito", count: s.distribution['SATISFEITO'] || 0, color: "#84cc15", icon: Smile },
                            { label: "Regular", count: s.distribution['REGULAR'] || 0, color: "#e9b306", icon: Meh },
                            { label: "Insatisfeito", count: s.distribution['INSATISFEITO'] || 0, color: "#f97316", icon: Frown },
                            { label: "Muito Insatisfeito", count: s.distribution['MUITO INSATISFEITO'] || 0, color: "#ef4444", icon: Angry },
                        ];
                    } else if (q.type === 'SMILE 4') {
                        options = [
                            { label: "EXCELENTE", count: s.distribution['EXCELENTE'] || 0, color: "#22c55d", icon: Laugh },
                            { label: "BOM", count: s.distribution['BOM'] || 0, color: "#84cc15", icon: Smile },
                            { label: "REGULAR", count: s.distribution['REGULAR'] || 0, color: "#e9b306", icon: Meh },
                            { label: "RUIM", count: s.distribution['RUIM'] || 0, color: "#ef4444", icon: Frown },
                        ];
                    } else {
                        // For other types (Colaborador, Multi-choice, etc.)
                        // If we have pre-defined options in the campaign, use them
                        if (q.options && q.options.length > 0) {
                            options = q.options.map((o: any) => ({ 
                                label: o.text, 
                                count: s.distribution[String(o.text || '').toUpperCase()] || 0, 
                                color: '#3b82f6' 
                            }));
                        } else {
                            // Otherwise fallback to distribution keys (e.g. dynamic collaborators)
                            options = Object.entries(s.distribution || {}).map(([label, count]) => ({
                                label,
                                count: Number(count),
                                color: '#3b82f6'
                            })).sort((a, b) => b.count - a.count);
                        }
                    }

                    const percs = calculatePercentages(options.map(o => o.count));
                    
                    return (
                      <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <h4 className="text-sm font-bold text-slate-800 pr-4 leading-tight">{idx + 1}ª) {q.text}</h4>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Satisfação</span>
                                <p className="text-sm font-black text-green-500">{formatPercent(s.satisfaction || 0)}%</p>
                            </div>
                        </div>
                        <div className="space-y-4 flex-1">
                            {options.map((o: any, oIdx) => (
                                <div key={oIdx} className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                        <div className="flex items-center gap-1">
                                            {o.icon && <o.icon size={12} strokeWidth={3} />}
                                            <span>{o.label}</span>
                                        </div>
                                        <span>({o.count}) {percs[oIdx]}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${s.count > 0 ? (o.count / s.count) * 100 : 0}%` }} className="h-full" style={{ backgroundColor: o.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engajamento</span>
                            <span className="text-sm font-black text-slate-800">{s.count}</span>
                        </div>
                      </motion.div>
                    );
                  })}

                    {npsData && npsData.question && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border-2 border-blue-100 flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-50 rounded-full">Auditoria NPS</span>
                                <h4 className="text-sm font-bold text-slate-800 mt-2 leading-tight">{npsData.question?.text || 'Métrica NPS'}</h4>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota Final</span>
                                <p className="text-sm font-black text-blue-600">{formatPercent(npsData.score)}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                            {[
                                { label: 'Promotores (9-10)', count: npsData.promotores, color: '#22c55d', icon: Smile },
                                { label: 'Neutros (7-8)', count: npsData.neutros, color: '#f1c40f', icon: Meh },
                                { label: 'Detratores (0-6)', count: npsData.detratores, color: '#e74b3c', icon: Frown },
                            ].map((o, oIdx) => {
                                const p = npsData.total > 0 ? (o.count / npsData.total) * 100 : 0;
                                return (
                                    <div key={oIdx} className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <o.icon size={12} strokeWidth={3} style={{ color: o.color }} />
                                                <span>{o.label}</span>
                                            </div>
                                            <span>({o.count}) {p.toFixed(2).replace('.', ',')}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${p}%` }} className="h-full" style={{ backgroundColor: o.color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>Total Participações</span>
                            <span className="text-sm font-black text-slate-800">{npsData.total}</span>
                        </div>
                    </motion.div>
                  )}
                  {responses.length === 0 && (
                      <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                          <AlertCircle className="mx-auto text-slate-300 mb-4" size={48} />
                          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum dado encontrado para o dia de referência.</p>
                      </div>
                  )}
                </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center gap-3 text-slate-800">
                        <TrendingUp className="text-blue-500" />
                        <h3 className="text-lg font-black uppercase tracking-tight">Evolução Diária</h3>
                    </div>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={processEvolutionData()}>
                                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                                <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={4} fill="url(#g)" />
                                <XAxis hide dataKey="n" /><YAxis hide domain={[0,100]} />
                                <Tooltip formatter={(v: any) => v != null ? `${Number(v).toFixed(2).replace('.', ',')}%` : 'Sem dados'} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amostragem</span>
                        <p className="text-4xl font-black text-slate-800">{responses.length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                    <Calendar className="mx-auto text-green-500 mb-2" size={32} strokeWidth={2.5} />
                    <p className="text-lg font-black text-slate-800">{todayLabel}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Relatório</p>
                </div>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-slate-400">beend.tech security & automated reporting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-zinc-900 border border-white/5 rounded-3xl p-8 shadow-2xl text-center space-y-8">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20"><ShieldCheck className="text-blue-500" size={32} /></div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Acesso Seguro</h2>
          <p className="text-sm text-zinc-500 font-medium tracking-tight">Insira o código enviado por e-mail para validar seus dados.</p>
        </div>
        <div className="space-y-4">
          <input type="text" value={token} onChange={(e) => setToken(e.target.value)} placeholder="TOKEN DE ACESSO..." className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-center text-lg tracking-widest focus:border-blue-500 outline-none transition-all placeholder:text-zinc-800" />
          <button onClick={() => handleValidate(token)} disabled={loading || !token} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-xl shadow-blue-500/20">
            {loading ? <Loader2 className="animate-spin" /> : <>Validar Canal <ArrowRight size={18} /></>}
          </button>
        </div>
        {error && <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>}
      </motion.div>
    </div>
  );
}
