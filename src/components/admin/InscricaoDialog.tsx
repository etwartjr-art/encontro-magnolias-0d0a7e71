import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type StatusInscricao =
  | "pendente"
  | "pago"
  | "recusado"
  | "reembolsado"
  | "chargeback";

type Inscricao = {
  id?: string;
  nome: string;
  email: string;
  celular: string;
  valor: number;
  valor_liquido: number;
  status: StatusInscricao;
};

interface InscricaoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (inscricao: Inscricao) => Promise<void>;
  initialData?: Inscricao | null;
}

export const InscricaoDialog = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}: InscricaoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Inscricao>({
    nome: "",
    email: "",
    celular: "",
    valor: 44.9,
    valor_liquido: 41.56,
    status: "pendente",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        nome: "",
        email: "",
        celular: "",
        valor: 44.9,
        valor_liquido: 41.56,
        status: "pendente",
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Inscrição" : "Nova Inscrição"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="celular">Celular</Label>
            <Input
              id="celular"
              value={formData.celular}
              onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor Bruto</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setFormData({ 
                    ...formData, 
                    valor: val,
                    valor_liquido: val * 0.9256 // Mantendo a proporção aproximada
                  });
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_liquido">Valor Líquido</Label>
              <Input
                id="valor_liquido"
                type="number"
                step="0.01"
                value={formData.valor_liquido}
                onChange={(e) =>
                  setFormData({ ...formData, valor_liquido: parseFloat(e.target.value) })
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) =>
                setFormData({ ...formData, status: v as StatusInscricao })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="recusado">Recusado</SelectItem>
                <SelectItem value="reembolsado">Reembolsado</SelectItem>
                <SelectItem value="chargeback">Chargeback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
