import { prisma, authenticateToken, whitelist, isMasterAdmin } from "../deps";

// Shop Products
export function registerShopRoutes(app: any) {
  app.get("/api/products", async (req: any, res: any) => {
    try {
      const products = await prisma.shopProduct.findMany({
        orderBy: { created_at: "desc" }
      });
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/products", authenticateToken, async (req: any, res: any) => {
    try {
      if (!isMasterAdmin(req)) {
        return res.status(403).json({ error: "Only master admin can manage products" });
      }
      const product = await prisma.shopProduct.create({
        data: { ...whitelist(req.body, ["name", "description", "price", "featured_image", "images", "features", "color"]), user_id: req.user.id }
      });
      res.json(product);
    } catch (err: any) {
      console.error("Product create error:", err);
      res.status(500).json({ error: "Erro ao criar produto." });
    }
  });

  app.patch("/api/products/:id", authenticateToken, async (req: any, res: any) => {
    try {
      if (!isMasterAdmin(req)) {
        return res.status(403).json({ error: "Only master admin can manage products" });
      }
      const product = await prisma.shopProduct.update({
        where: { id: req.params.id },
        data: whitelist(req.body, ["name", "description", "price", "featured_image", "images", "features", "color"])
      });
      res.json(product);
    } catch (err: any) {
      console.error("Product update error:", err);
      res.status(500).json({ error: "Erro ao atualizar produto." });
    }
  });

  app.delete("/api/products/:id", authenticateToken, async (req: any, res: any) => {
    try {
      if (!isMasterAdmin(req)) {
        return res.status(403).json({ error: "Only master admin can manage products" });
      }
      await prisma.shopProduct.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}