import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const AcceptInvite = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
    const [message, setMessage] = useState("Verifying invitation...");
    const [inviteDetails, setInviteDetails] = useState<any>(null);

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid invitation link");
            setLoading(false);
            return;
        }

        verifyInvite();
    }, [token]);

    const verifyInvite = async () => {
        try {
            // Check if user is logged in
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // Store token in local storage to handle after login
                localStorage.setItem("pendingInviteToken", token!);
                toast.info("Please sign in to accept the invitation");
                navigate("/auth");
                return;
            }

            // Get invite details using the secure function
            const { data, error } = await supabase
                .rpc("get_invitation_by_token", { lookup_token: token });

            if (error) throw error;

            if (!data || data.length === 0) {
                setStatus("error");
                setMessage("Invitation not found or expired.");
                setLoading(false);
                return;
            }

            setInviteDetails(data[0]);
            setLoading(false);
        } catch (error: any) {
            console.error("Error verifying invite:", error);
            setStatus("error");
            setMessage("Failed to verify invitation.");
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .rpc("accept_invitation", { lookup_token: token });

            if (error) throw error;

            if (!data.success) {
                throw new Error(data.message);
            }

            setStatus("success");
            setMessage("You have successfully joined the household!");
            toast.success("Joined household successfully!");

            setTimeout(() => {
                navigate("/dashboard");
            }, 2000);
        } catch (error: any) {
            toast.error(error.message || "Failed to accept invitation");
            setStatus("error");
            setMessage(error.message || "Failed to accept invitation");
        } finally {
            setLoading(false);
        }
    };

    if (status === "verifying" || (loading && !inviteDetails)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-6">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
                        <p className="text-muted-foreground">{message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
                            <XCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle>Invitation Error</CardTitle>
                        <CardDescription>{message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/dashboard")} variant="outline">
                            Go to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle>Welcome!</CardTitle>
                        <CardDescription>{message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/dashboard")}>
                            Go to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle>Join Household</CardTitle>
                    <CardDescription>
                        You have been invited to join <strong>{inviteDetails?.household_name}</strong>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg text-sm text-center">
                        <p>You will join as a <strong>{inviteDetails?.role}</strong>.</p>
                        <p className="text-muted-foreground mt-1">
                            This will give you access to view and manage the household budget.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => navigate("/dashboard")}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleAccept} disabled={loading}>
                            {loading ? "Joining..." : "Accept Invitation"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AcceptInvite;
