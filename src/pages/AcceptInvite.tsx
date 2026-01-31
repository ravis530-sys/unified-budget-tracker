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
    const [status, setStatus] = useState<"verifying" | "idle" | "success" | "error">("verifying");
    const [message, setMessage] = useState("Verifying invitation...");
    const [inviteDetails, setInviteDetails] = useState<any>(null);

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid invitation link");
            setLoading(false);
            return;
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(token)) {
            setStatus("error");
            setMessage("Invalid invitation token format");
            setLoading(false);
            return;
        }

        verifyInvite();
    }, [token]);

    const verifyInvite = async () => {
        console.log("Starting invitation verification for token:", token);
        try {
            // Check if user is logged in
            console.log("Checking session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error("Session error (AcceptInvite):", sessionError);
                // Aggressive Local Cleanup: stop the browser from trying to refresh a dead token
                if (sessionError.status === 400 || sessionError.message.includes("Refresh Token")) {
                    console.warn("Detected stale refresh token. Performing local cleanup.");
                    localStorage.removeItem("supabase.auth.token");
                    localStorage.removeItem("pendingInviteToken");
                    window.location.href = `/auth?mode=signup&inviteToken=${token}`;
                } else {
                    localStorage.setItem("pendingInviteToken", token!);
                    toast.error("Your session has expired. Please log in again.");
                    navigate("/auth?mode=signup");
                }
                return;
            }

            if (!session) {
                console.log("No active session found. Storing token and redirecting to auth.");
                // Store token in local storage to handle after login
                localStorage.setItem("pendingInviteToken", token!);
                toast.info("Please create an account to accept the invitation");
                navigate("/auth?mode=signup");
                return;
            }

            console.log("Session verified for user:", session.user.id);

            // Timeout protection
            console.log("Fetching invitation details via RPC 'get_invitation_by_token'...");
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Verification timed out. Please check your network or try again.")), 15000)
            );

            // Get invite details using the secure function
            const rpcPromise = supabase
                .rpc("get_invitation_by_token", { lookup_token: token });

            const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

            if (error) {
                console.error("RPC 'get_invitation_by_token' failed:", error);
                throw error;
            }

            console.log("Invitation data received:", data);

            if (!data || data.length === 0) {
                console.warn("No invitation data found for this token.");
                setStatus("error");
                setMessage("Invitation not found or expired.");
                setLoading(false);
                return;
            }

            console.log("Setting invite details and status to idle.");
            setInviteDetails(data[0]);
            setStatus("idle");
            setLoading(false);
        } catch (error: any) {
            console.error("Critical error in verifyInvite:", error);
            setStatus("error");
            setMessage("Failed to verify invitation. " + (error.message || ""));
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        console.log("User clicked 'Accept Invitation'.");
        setLoading(true);
        try {
            console.log("Invoking RPC 'accept_invitation' for token:", token);
            const { data, error } = await supabase
                .rpc("accept_invitation", { lookup_token: token });

            if (error) {
                console.error("RPC 'accept_invitation' failed:", error);
                throw error;
            }

            console.log("Accept invitation response data:", data);

            if (!data.success) {
                console.error("Invitation acceptance logic failed:", data.message);
                throw new Error(data.message);
            }

            // Clear the token from local storage to prevent redirect loops from Dashboard
            console.log("Clearing pendingInviteToken from local storage.");
            localStorage.removeItem("pendingInviteToken");

            console.log("Invitation accepted successfully. Updating UI and navigating...");
            setStatus("success");
            setMessage("You have successfully joined the household!");
            toast.success("Joined household successfully!");

            setTimeout(() => {
                console.log("Redirecting to dashboard.");
                navigate("/dashboard");
            }, 2000);
        } catch (error: any) {
            console.error("Critical error in handleAccept:", error);
            toast.error(error.message || "Failed to accept invitation");
            setStatus("error");
            setMessage(error.message || "Failed to accept invitation");
        } finally {
            setLoading(false);
        }
    };

    if (status === "verifying") {
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
