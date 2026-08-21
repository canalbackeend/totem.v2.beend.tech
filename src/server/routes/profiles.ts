import bcrypt from "bcryptjs";
import { prisma, authenticateToken, whitelist, publicUser, isMasterAdmin } from "../deps";

// Profile / Profiles
export function registerProfileRoutes(app: any) {
  app.patch("/api/profiles/:id", authenticateToken, async (req: any, res: any) => {
    if (req.user.id !== req.params.id && !isMasterAdmin(req)) {
       return res.sendStatus(403);
    }
    try {
      const { password, ...rest } = req.body;
      const allowedFields = ["nome", "empresa", "telefone", "cep", "endereco", "complemento", "cidade", "estado", "logo_url"];
      const updateData: any = whitelist(rest, allowedFields);
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      const profile = await prisma.user.update({
        where: { id: req.params.id },
        data: updateData
      });
      res.json(publicUser(profile));
    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
  });
}