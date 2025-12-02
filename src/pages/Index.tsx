import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, PieChart, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">BudgetTrack</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your complete financial companion for tracking earnings, expenses, and achieving your savings goals
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-6 rounded-lg border">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Track Income & Expenses</h3>
            <p className="text-muted-foreground">
              Easily record and categorize all your earnings and expenses with detailed breakdowns
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <PieChart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Visual Analytics</h3>
            <p className="text-muted-foreground">
              View percentage breakdowns and trends with beautiful charts and insights
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border">
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your financial data is encrypted and protected with enterprise-grade security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
