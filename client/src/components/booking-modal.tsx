import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { insertBookingSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Default options (fallback if config is not loaded)
const DEFAULT_THEATRE_OPTIONS = [
  "Screen 1",
  "Screen 2", 
  "Screen 3",
  "VIP Screen"
];

const DEFAULT_TIME_SLOTS = [
  "2:30 PM",
  "5:00 PM",
  "8:15 PM", 
  "11:00 PM"
];

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BookingModal({ isOpen, onClose, onSuccess }: BookingModalProps) {
  const { toast } = useToast();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch configuration for theatres and time slots
  const { data: config } = useQuery({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use config data or fallback to defaults
  const theatreOptions = (config as { theatres?: string[] })?.theatres || DEFAULT_THEATRE_OPTIONS;
  const timeSlots = (config as { timeSlots?: string[] })?.timeSlots || DEFAULT_TIME_SLOTS;

  const form = useForm({
    resolver: zodResolver(insertBookingSchema.extend({
      totalAmount: insertBookingSchema.shape.totalAmount.refine(val => Number(val) > 0, "Total amount must be greater than 0"),
      cashAmount: insertBookingSchema.shape.cashAmount.refine(val => Number(val) >= 0, "Cash amount cannot be negative"),
      upiAmount: insertBookingSchema.shape.upiAmount.refine(val => Number(val) >= 0, "UPI amount cannot be negative"),
    })),
    defaultValues: {
      theatreName: "",
      timeSlot: "",
      guests: "1",
      customerName: "",
      phoneNumber: "",
      age: "",
      totalAmount: "",
      cashAmount: "0",
      upiAmount: "0",
      bookingDate: new Date().toISOString().split('T')[0],
      isEighteenPlus: true,
      eighteenPlusReason: "",
      eighteenPlusDescription: "",
      visited: true,
      visitedReason: "",
      visitedDescription: "",
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/bookings", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
      // Reset session timer start to now to reflect fresh login activity (optional UX)
      try { localStorage.setItem("loginStart", Date.now().toString()); } catch {}
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/time-slots"] });
      form.reset();
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  const validateAmounts = () => {
    const values = form.getValues();
    const errors: string[] = [];

    const totalAmount = Number(values.totalAmount) || 0;
    const cashAmount = Number(values.cashAmount) || 0;
    const upiAmount = Number(values.upiAmount) || 0;

    // Validate main payment amounts
    if (Math.abs((cashAmount + upiAmount) - totalAmount) > 0.01) {
      errors.push("Cash + UPI must equal total amount");
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const onSubmit = (data: any) => {
    if (!validateAmounts()) {
      return;
    }
    createBookingMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setValidationErrors([]);
    onClose();
  };

  // Auto-calculate UPI when total or cash changes
  const handleTotalOrCashChange = () => {
    const totalAmount = Number(form.getValues("totalAmount")) || 0;
    const cashAmount = Number(form.getValues("cashAmount")) || 0;
    const calculatedUpi = Math.max(0, totalAmount - cashAmount);
    form.setValue("upiAmount", calculatedUpi.toString());
    validateAmounts();
  };



  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-rosae-dark-gray border-gray-600 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            New Theatre Booking
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="theatreName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Theatre Name</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white" data-testid="select-theatre-name">
                          <SelectValue placeholder="Select theatre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {theatreOptions.map((theatre: string) => (
                          <SelectItem key={theatre} value={theatre}>
                            {theatre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeSlot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Time Slot</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white" data-testid="select-time-slot">
                          <SelectValue placeholder="Select time slot" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {timeSlots.map((slot: string) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Number of Guests</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="4"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-guests"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Customer Name *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter customer name"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-customer-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+91 9876543210"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-phone-number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="120"
                        placeholder="25"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-age"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bookingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Booking Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-booking-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Total Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1200"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-total-amount"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setTimeout(handleTotalOrCashChange, 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cashAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Amount Paid (Cash)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="800"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-cash-amount"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setTimeout(handleTotalOrCashChange, 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="upiAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Amount Paid (UPI)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="400"
                        className="bg-gray-800 border-gray-600 text-white"
                        data-testid="input-upi-amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 18+ Status Toggle */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isEighteenPlus"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-600 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-gray-300">18+ Content</FormLabel>
                      <div className="text-sm text-gray-400">
                        Is the customer 18+?
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-eighteen-plus"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch("isEighteenPlus") && (
                <div className="space-y-4 pl-4 border-l-2 border-red-500">
                  <FormField
                    control={form.control}
                    name="eighteenPlusReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Reason for No</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="cancelled_show">Cancelled Show</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="eighteenPlusDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter description for the reason"
                            className="bg-gray-800 border-gray-600 text-white"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Visited Status Toggle */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="visited"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-600 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-gray-300">Visited</FormLabel>
                      <div className="text-sm text-gray-400">
                        Did the customer visit for this booking?
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-visited"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch("visited") && (
                <div className="space-y-4 pl-4 border-l-2 border-yellow-500">
                  <FormField
                    control={form.control}
                    name="visitedReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Reason for No</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="rescheduled">Rescheduled</SelectItem>
                            <SelectItem value="by_mistake">By Mistake</SelectItem>
                            <SelectItem value="didnt_come">Didn't Come</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="visitedDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter description for the reason"
                            className="bg-gray-800 border-gray-600 text-white"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>



            <div className="flex items-center justify-between pt-6 border-t border-gray-600">
              <div className="text-sm">
                {validationErrors.length > 0 && (
                  <div className="space-y-1">
                    {validationErrors.map((error, index) => (
                      <p key={index} className="text-rosae-red" data-testid="text-validation-error">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  data-testid="button-cancel-booking"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBookingMutation.isPending || validationErrors.length > 0}
                  className="bg-rosae-red hover:bg-rosae-dark-red"
                  data-testid="button-save-booking"
                >
                  <Save className="mr-2 w-4 h-4" />
                  {createBookingMutation.isPending ? "Saving..." : "Save Booking"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
