import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Check, Mail } from "lucide-react";

interface InviteMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    householdName: string;
    onSuccess: () => void;
}

const InviteMemberDialog = ({
    open,
    onOpenChange,
    householdId,
    householdName,
    onSuccess,
}: InviteMemberDialogProps) => {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"admin" | "member">("member");
    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("household_invitations")
                .insert({
                    household_id: householdId,
                    email,
                    role,
                })
                .select("token")
                .single();

            if (error) throw error;

            const link = `${window.location.origin}/accept-invite/${data.token}`;
            setInviteLink(link);

            toast.success("Invitation generated! You can now share the link.");
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || "Failed to create invitation");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Link copied to clipboard");
        }
    };

    const shareViaEmail = () => {
        if (inviteLink) {
            const subject = "Join my household on BudgetTrack";
            const body = `Hi,\n\nI've invited you to join my household on BudgetTrack so we can manage our finances together.\n\nClick the link below to join:\n${inviteLink}\n\nThis link expires in 7 days.`;
            window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    };

    const resetForm = () => {
        setEmail("");
        setRole("member");
        setInviteLink(null);
        setCopied(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) resetForm();
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite Family Member</DialogTitle>
                    <DialogDescription>
                        Create an invitation link to share with your family member.
                    </DialogDescription>
                </DialogHeader>

                {!inviteLink ? (
                    <form onSubmit={handleInvite} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="member@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={role} onValueChange={(val: "admin" | "member") => setRole(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">Member (Can view and add transactions)</SelectItem>
                                    <SelectItem value="admin">Admin (Can manage settings and members)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Creating Invitation..." : "Generate Invite Link"}
                        </Button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg space-y-2">
                            <Label>Invitation Link</Label>
                            <div className="flex items-center gap-2">
                                <Input value={inviteLink} readOnly className="bg-background" />
                                <Button size="icon" variant="outline" onClick={copyToClipboard}>
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Share this link with {email}. It expires in 7 days.
                            </p>
                        </div>

                        <Button
                            className="w-full"
                            onClick={shareViaEmail}
                        >
                            <Mail className="mr-2 h-4 w-4" />
                            Share via Email
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                resetForm();
                                onOpenChange(false);
                            }}
                        >
                            Done
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default InviteMemberDialog;
