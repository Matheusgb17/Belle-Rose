import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminUser, resolveLoginEmail } from "@/lib/booking.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Acesso restrito — Belle Rosé" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [username, setUsername] = useState("adm");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ensureFn = useServerFn(ensureAdminUser);
  const resolveFn = useServerFn(resolveLoginEmail);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Bootstrap admin if needed
      if (username === "adm") {
        await ensureFn({});
      }
      const { email } = await resolveFn({ data: { username } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vinda!");
      navigate({ to: "/painel" });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero px-4">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="h-3 w-3" /> Voltar ao site
        </Link>
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-full gradient-rose flex items-center justify-center shadow-soft">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
        <h1 className="font-display text-3xl text-center mb-2">Área restrita</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Entre com seu usuário e senha.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Usuário</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Administrador padrão: <code className="bg-muted px-1 rounded">adm</code> / <code className="bg-muted px-1 rounded">123</code>
        </p>
      </Card>
    </div>
  );
}
