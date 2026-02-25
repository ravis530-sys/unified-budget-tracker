import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface DashboardSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    isEmpty?: boolean;
    className?: string;
}

export const DashboardSection = ({
    title,
    description,
    children,
    defaultOpen = true,
    isEmpty = false,
    className,
}: DashboardSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // Automatically collapse if the section becomes empty (e.g., when switching months)
    React.useEffect(() => {
        if (isEmpty) {
            setIsOpen(false);
        } else {
            // Auto-expand if it's not empty and was either defaultOpen or recently cleared of isEmpty status
            setIsOpen(true);
        }
    }, [isEmpty]);

    return (
        <Card className={className}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            {title}
                            {isEmpty && (
                                <span className="text-xs font-normal text-white bg-red-500 px-2 py-0.5 rounded-full">
                                    No data
                                </span>
                            )}
                        </CardTitle>
                        {description && <CardDescription>{description}</CardDescription>}
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                            {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle</span>
                        </Button>
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent forceMount>
                    <div className={isOpen ? "block" : "hidden"}>
                        <CardContent>{children}</CardContent>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

export default DashboardSection;
