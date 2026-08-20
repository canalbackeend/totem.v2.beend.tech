import { prisma, authenticateToken, ADMIN_EMAIL } from "../deps";
import { transporter } from "../email";

async function generateProposalNumber() {
  const year = new Date().getFullYear();
  const prefix = "PROP-" + year + "-";
  const last = await prisma.proposal.findFirst({
    where: { proposal_number: { startsWith: prefix } },
    orderBy: { proposal_number: "desc" },
    select: { proposal_number: true }
  });
  if (!last) return prefix + "0001";
  const lastNum = parseInt(last.proposal_number.split("-")[2], 10);
  const nextNum = lastNum + 1;
  const padded = nextNum.toString().padStart(4, "0");
  return prefix + padded;
}

// --- PROPOSALS (Admin Only) ---
export function registerProposalRoutes(app: any) {
  app.get("/api/proposals", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const status = req.query.status as string;
      const search = req.query.search as string;
      
      const where: any = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { client_name: { contains: search, mode: "insensitive" } },
          { proposal_number: { contains: search, mode: "insensitive" } }
        ];
      }

      const [data, count] = await Promise.all([
        prisma.proposal.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.proposal.count({ where })
      ]);

      res.json({ data, count, page, pageSize });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/proposals/:id", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
      if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/proposals", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const proposalNumber = await generateProposalNumber();
      const today = new Date();
      const validity = new Date(today);
      validity.setDate(validity.getDate() + 10);

      const defaults = {
        greeting: ``,
        general_description: "Temos o prazer de apresentar nossa solução completa de coleta de feedbacks e pesquisa de satisfação. Nossa plataforma oferece terminais inteligentes integrados a um painel de análise em tempo real, permitindo que você transforme cada interação em insights valiosos para o crescimento do seu negócio.",
        implementation_reqs: "• Instalação e configuração dos terminais\n• Criação e personalização das campanhas de pesquisa\n• Treinamento da equipe para operação do sistema\n• Integração com sistemas existentes (se aplicável)",
        technical_support: "Suporte técnico: especializado durante horário comercial (segunda a sexta, 9h às 18h). Atendimento via telefone, e-mail e acesso remoto quando necessário.",
        warranty: "Garantia: 12 meses contra defeitos de fabricação e funcionamento. Manutenção preventiva e corretiva inclusas durante o período de vigência do contrato.",
        resources: ["Principais tipos de campanhas: NPS, CSAT, SMILE e QUIZ", "Receba feedback dos seus clientes em tempo real", "Gerencie perguntas e respostas de forma simples", "Vários terminais ao mesmo tempo de forma geral ou individual", "Gráfico de evolução", "Pergunta aberta", "Relatórios diários via email no horário marcado", "Relatórios por data e horários", "Lista de clientes cadastrados (Caso haja um formulário de cadastro ativado)", "Exportação de dados em PDF, Excel e CSV", "Gerencie várias campanhas simultâneas", "Acesso individual para cada terminal", "Análise de sentimento com IA"],
        payment_terms: "Pagamento: via boleto bancário ou PIX, com vencimento todo dia 10 de cada mês. Primeiro faturamento após a instalação dos terminais.",
        final_considerations: "Esta proposta é válida até a data de vencimento indicada acima. Após este período, os valores poderão ser revisados."
      };

      const proposal = await prisma.proposal.create({
        data: {
          proposal_number: proposalNumber,
          client_name: req.body.client_name || "",
          contact_person: req.body.contact_person || "",
          email: req.body.email || "",
          phone: req.body.phone || "",
          cep: req.body.cep || "",
          address: req.body.address || "",
          proposal_date: req.body.proposal_date || today.toISOString().split("T")[0],
          validity_date: req.body.validity_date || validity.toISOString().split("T")[0],
          greeting: req.body.greeting || defaults.greeting,
          general_description: req.body.general_description || defaults.general_description,
          implementation_reqs: req.body.implementation_reqs || defaults.implementation_reqs,
          technical_support: req.body.technical_support || defaults.technical_support,
          warranty: req.body.warranty || defaults.warranty,
          resources: req.body.resources || defaults.resources,
          payment_terms: req.body.payment_terms || defaults.payment_terms,
          final_considerations: req.body.final_considerations || defaults.final_considerations,
          observations: req.body.observations || "",
          plan_type: req.body.plan_type || "Mensal",
          monthly_value: parseFloat(req.body.monthly_value) || 0,
          plan_description: req.body.plan_description || "",
          items: req.body.items || [],
          shipping_cost: parseFloat(req.body.shipping_cost) || 0,
          images: req.body.images || [],
          image_library: req.body.image_library || [],
          responsible_name: req.body.responsible_name || "",
          responsible_phone: req.body.responsible_phone || "",
          status: req.body.status || "Rascunho"
        }
      });

      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/proposals/:id", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const existing = await prisma.proposal.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: "Proposta não encontrada" });

      const updateData = { ...req.body };
      if (updateData.items && Array.isArray(updateData.items)) {
        updateData.items = updateData.items.map((item: any) => ({
          ...item,
          total: (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0)
        }));
      }
      if (updateData.monthly_value) updateData.monthly_value = parseFloat(updateData.monthly_value);
      if (updateData.shipping_cost) updateData.shipping_cost = parseFloat(updateData.shipping_cost);

      const proposal = await prisma.proposal.update({
        where: { id: req.params.id },
        data: updateData
      });

      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/proposals/:id", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      await prisma.proposal.delete({ where: { id: req.params.id } });
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/proposals/:id/clone", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const existing = await prisma.proposal.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: "Proposta não encontrada" });

      const proposalNumber = await generateProposalNumber();
      const today = new Date();
      const validity = new Date(today);
      validity.setDate(validity.getDate() + 10);

      const cloned = await prisma.proposal.create({
        data: {
          proposal_number: proposalNumber,
          client_name: existing.client_name,
          contact_person: existing.contact_person,
          email: existing.email,
          phone: existing.phone,
          cep: existing.cep,
          address: existing.address,
          proposal_date: today.toISOString().split("T")[0],
          validity_date: validity.toISOString().split("T")[0],
          greeting: existing.greeting,
          general_description: existing.general_description,
          implementation_reqs: existing.implementation_reqs,
          technical_support: existing.technical_support,
          warranty: existing.warranty,
          resources: existing.resources,
          payment_terms: existing.payment_terms,
          final_considerations: existing.final_considerations,
          plan_type: existing.plan_type,
          monthly_value: existing.monthly_value,
          plan_description: existing.plan_description,
          items: existing.items,
          shipping_cost: existing.shipping_cost,
          images: [],
          image_library: existing.image_library,
          responsible_name: existing.responsible_name,
          responsible_phone: existing.responsible_phone,
          status: "Rascunho"
        }
      });

      res.json(cloned);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/proposals/:id/status", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const { status } = req.body;
      if (!["Rascunho", "Enviada", "Aprovada", "Recusada"].includes(status)) {
        return res.status(400).json({ error: "Status inválido" });
      }
      const proposal = await prisma.proposal.update({
        where: { id: req.params.id },
        data: { status }
      });
      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/proposals/:id/send", authenticateToken, async (req: any, res) => {
    if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
    try {
      const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
      if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
      if (!proposal.email) return res.status(400).json({ error: "E-mail do cliente não informado" });

      const items = (proposal.items as any[]) || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
      const totalGeral = subtotal + (proposal.shipping_cost || 0);

      const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const itemsHtml = items.map((item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name || "-"}${item.description ? `<br><small style="color: #999;">${item.description}</small>` : ""}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty || 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">R$ ${formatCurrency(parseFloat(item.unit_price) || 0)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">R$ ${formatCurrency(parseFloat(item.total) || 0)}</td>
        </tr>
      `).join("");

      const appUrl = process.env.APP_URL || "https://totem.v2.beend.tech";
      const proposalLink = `${appUrl}/propostas/visualizar/${proposal.id}`;

      const mailOptions = {
        from: `"beend.tech" <${process.env.GMAIL_USER}>`,
        to: proposal.email,
        subject: `Proposta Comercial ${proposal.proposal_number} - beend.tech`,
        html: `
          <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #0b82ff, #0b6ed4); padding: 25px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">beend.tech</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Solução Inteligente de Feedback</p>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #333; margin: 0 0 5px;">Proposta Comercial ${proposal.proposal_number}</h2>
              <p style="color: #999; font-size: 13px; margin: 0 0 25px;">${proposal.client_name}</p>
              
              ${proposal.greeting || proposal.general_description ? `
              <p style="color: #555; font-size: 15px; line-height: 1.6;">${proposal.greeting ? proposal.greeting + (proposal.client_name ? " " + proposal.client_name : "") : ""}</p>
              <p style="color: #555; font-size: 14px; line-height: 1.6;">${proposal.general_description || ""}</p>
              ` : ""}
              
              ${items.length > 0 ? `
                <div style="margin: 25px 0;">
                  <h3 style="color: #333; font-size: 16px; border-bottom: 2px solid #0b82ff; padding-bottom: 8px;">Itens e Valores</h3>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                    <thead>
                      <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; text-align: left; font-size: 12px; color: #666; width: 45%;">Item</th>
                        <th style="padding: 10px; text-align: center; font-size: 12px; color: #666; width: 10%;">Qtd</th>
                        <th style="padding: 10px; text-align: right; font-size: 12px; color: #666; width: 22%;">Unitário</th>
                        <th style="padding: 10px; text-align: right; font-size: 12px; color: #666; width: 23%;">Total</th>
                      </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                    <tfoot>
                      <tr style="background: #f5f5f5;">
                        <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; color: #333;">Subtotal:</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold; color: #333;">R$ ${formatCurrency(subtotal)}</td>
                      </tr>
                      ${proposal.shipping_cost > 0 ? `
                      <tr style="background: #f5f5f5;">
                        <td colspan="3" style="padding: 10px; text-align: right; color: #666;">Frete:</td>
                        <td style="padding: 10px; text-align: right; color: #666;">R$ ${formatCurrency(proposal.shipping_cost || 0)}</td>
                      </tr>` : ""}
                      <tr style="background: #0b82ff; color: white;">
                        <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px;">TOTAL:</td>
                        <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px;">R$ ${formatCurrency(totalGeral)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ` : ""}
              
              ${proposal.payment_terms ? `
                <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                  <h4 style="color: #333; margin: 0 0 8px; font-size: 14px;">Forma de Pagamento</h4>
                  <p style="color: #555; margin: 0; font-size: 14px; line-height: 1.5;">${proposal.payment_terms}</p>
                </div>
              ` : ""}
              
              ${proposal.observations ? `
                <div style="margin: 20px 0; padding: 15px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b;">
                  <h4 style="color: #333; margin: 0 0 8px; font-size: 14px;">Observações</h4>
                  <p style="color: #555; margin: 0; font-size: 14px; line-height: 1.5;">${proposal.observations}</p>
                </div>
              ` : ""}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${proposalLink}" style="background-color: #0b82ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Baixar Proposta Completa (PDF)
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px; font-style: italic;">
                * Proposta válida até ${new Date(proposal.validity_date).toLocaleDateString("pt-BR")}.
              </p>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} beend.tech. Todos os direitos reservados.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      await prisma.proposal.update({
        where: { id: req.params.id },
        data: { status: "Enviada" }
      });

      res.json({ message: "Proposta enviada com sucesso!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}