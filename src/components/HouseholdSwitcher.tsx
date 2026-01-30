import { useState } from "react";
import { Check, ChevronsUpDown, PlusCircle, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHousehold } from "@/hooks/useHousehold";
import { toast } from "sonner";

const HouseholdSwitcher = () => {
    const { household: activeHousehold, myHouseholds, switchHousehold, createHousehold } = useHousehold();
    const [open, setOpen] = useState(false);
    const [showNewDialog, setShowNewDialog] = useState(false);
    const [newHouseholdName, setNewHouseholdName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!newHouseholdName.trim()) return;

        setCreating(true);
        try {
            await createHousehold(newHouseholdName);
            setShowNewDialog(false);
            setNewHouseholdName("");
            toast.success("Household created successfully!");
        } catch (error) {
            toast.error("Failed to create household");
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[130px] md:w-[200px] justify-between bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
                    >
                        <Home className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                            {activeHousehold ? activeHousehold.name : "Select Household"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search household..." />
                        <CommandList>
                            <CommandEmpty>No household found.</CommandEmpty>
                            <CommandGroup heading="My Households">
                                {myHouseholds.map((h) => (
                                    <CommandItem
                                        key={h.id}
                                        value={h.name}
                                        onSelect={() => {
                                            switchHousehold(h.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                activeHousehold?.id === h.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {h.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        setOpen(false);
                                        setShowNewDialog(true);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <PlusCircle className="mr-2 h-5 w-5" />
                                    Create New Household
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Household</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Household Name</Label>
                            <Input
                                placeholder="e.g. Smith Family"
                                value={newHouseholdName}
                                onChange={(e) => setNewHouseholdName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleCreate} disabled={creating}>
                            {creating ? "Creating..." : "Create Household"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default HouseholdSwitcher;
