"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SettingsTabsProps = {
  profileContent: React.ReactNode;
  appearanceContent: React.ReactNode;
  dataContent: React.ReactNode;
};

export function SettingsTabs({
  profileContent,
  appearanceContent,
  dataContent,
}: SettingsTabsProps) {
  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">{profileContent}</TabsContent>
      <TabsContent value="appearance">{appearanceContent}</TabsContent>
      <TabsContent value="data">{dataContent}</TabsContent>
    </Tabs>
  );
}
