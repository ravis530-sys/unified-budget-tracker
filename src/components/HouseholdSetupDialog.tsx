import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface HouseholdSetupDialogProps {
  open: boolean;
  onSuccess: () => void;
  onCreateHousehold: (name: string) => Promise<any>;
}

const HouseholdSetupDialog = ({ open, onSuccess, onCreateHousehold }: HouseholdSetupDialogProps) => {
  const [householdName, setHouseholdName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!householdName.trim()) {
      toast.error("Please enter a household name");
      return;
    }

    setLoading(true);
    try {
      await onCreateHousehold(householdName);
      toast.success("Household created successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to create household");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Up Your Household</DialogTitle>
          <DialogDescription>
            Create your family household to start tracking budgets and expenses together.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="householdName">Household Name</Label>
            <Input
              id="householdName"
              placeholder="e.g., Smith Family, Our Home"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Household"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HouseholdSetupDialog;
