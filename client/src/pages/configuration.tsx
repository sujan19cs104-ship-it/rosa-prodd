import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function Configuration() {
  const { toast } = useToast();
  const [generalSettings, setGeneralSettings] = useState({
    theaterName: 'ROSAE Theatre',
    contactEmail: 'contact@rosaetheatre.com',
    phoneNumber: '+1 (555) 123-4567',
    address: '123 Broadway Ave, New York, NY 10001',
    enableNotifications: true,
  });

  const [bookingSettings, setBookingSettings] = useState({
    advanceBookingDays: 30,
    maxTicketsPerBooking: 10,
    enableOnlineBooking: true,
    showSeatMap: true,
  });

  const handleGeneralSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setGeneralSettings({
      ...generalSettings,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleBookingSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setBookingSettings({
      ...bookingSettings,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    });
  };

  const handleSaveSettings = () => {
    // Here you would typically save settings to your backend
    toast({
      title: 'Settings saved',
      description: 'Your configuration has been updated successfully.',
    });
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">System Configuration</h1>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="booking">Booking Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure your theatre's basic information and general settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theaterName">Theatre Name</Label>
                <Input
                  id="theaterName"
                  name="theaterName"
                  value={generalSettings.theaterName}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  value={generalSettings.contactEmail}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={generalSettings.phoneNumber}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={generalSettings.address}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableNotifications">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send email notifications for bookings and updates</p>
                </div>
                <Switch
                  id="enableNotifications"
                  name="enableNotifications"
                  checked={generalSettings.enableNotifications}
                  onCheckedChange={(checked) => 
                    setGeneralSettings({...generalSettings, enableNotifications: checked})
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings}>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="booking">
          <Card>
            <CardHeader>
              <CardTitle>Booking Settings</CardTitle>
              <CardDescription>
                Configure how customers can book tickets for your shows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="advanceBookingDays">Advance Booking Days</Label>
                <Input
                  id="advanceBookingDays"
                  name="advanceBookingDays"
                  type="number"
                  value={bookingSettings.advanceBookingDays}
                  onChange={handleBookingSettingsChange}
                />
                <p className="text-sm text-muted-foreground">How many days in advance can customers book tickets</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxTicketsPerBooking">Maximum Tickets Per Booking</Label>
                <Input
                  id="maxTicketsPerBooking"
                  name="maxTicketsPerBooking"
                  type="number"
                  value={bookingSettings.maxTicketsPerBooking}
                  onChange={handleBookingSettingsChange}
                />
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableOnlineBooking">Enable Online Booking</Label>
                  <p className="text-sm text-muted-foreground">Allow customers to book tickets online</p>
                </div>
                <Switch
                  id="enableOnlineBooking"
                  name="enableOnlineBooking"
                  checked={bookingSettings.enableOnlineBooking}
                  onCheckedChange={(checked) => 
                    setBookingSettings({...bookingSettings, enableOnlineBooking: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showSeatMap">Show Seat Map</Label>
                  <p className="text-sm text-muted-foreground">Display interactive seat map during booking</p>
                </div>
                <Switch
                  id="showSeatMap"
                  name="showSeatMap"
                  checked={bookingSettings.showSeatMap}
                  onCheckedChange={(checked) => 
                    setBookingSettings({...bookingSettings, showSeatMap: checked})
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings}>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}