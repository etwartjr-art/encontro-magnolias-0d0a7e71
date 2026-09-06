import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer } from "lucide-react";

type Inscricao = {
  id: string;
  nome: string;
  email: string;
  status: string;
};

const ListaPresenca = () => {
  const [items, setItems] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Lista de Presença · Encontro das Magnólias";
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, nome, email, status")
        .eq("status", "pago")
        .order("nome", { ascending: true });
      if (error) {
        setErro(error.message);
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <main className="min-h-screen bg-white text-black px-6 py-8 print:px-0 print:py-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao admin
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={loading || items.length === 0}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir lista
          </Button>
        </div>

        <header className="text-center mb-6">
          <p className="uppercase tracking-[0.3em] text-xs">Encontro das Magnólias</p>
          <h1 className="text-2xl font-bold mt-1">Lista de Presença</h1>
          <p className="text-sm mt-1">
            19 de setembro de 2026 · Salão de Festas — Residencial Ilhas Galápagos
          </p>
          <p className="text-xs mt-1">
            {items.length} inscrita{items.length === 1 ? "" : "s"} com pagamento confirmado
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16 print:hidden">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : erro ? (
          <p className="text-center text-red-600 py-8 print:hidden">
            Erro ao carregar: {erro}
          </p>
        ) : items.length === 0 ? (
          <p className="text-center py-8">Nenhuma inscrição paga até o momento.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-black px-2 py-2 w-10 text-center">Nº</th>
                <th className="border border-black px-2 py-2 text-left">Nome</th>
                <th className="border border-black px-2 py-2 text-left">E-mail</th>
                <th className="border border-black px-2 py-2 w-40 text-left">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={i.id}>
                  <td className="border border-black px-2 py-2 text-center">{idx + 1}</td>
                  <td className="border border-black px-2 py-2">{i.nome}</td>
                  <td className="border border-black px-2 py-2">{i.email}</td>
                  <td className="border border-black px-2 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
};

export default ListaPresenca;
