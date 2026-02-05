import { render, screen } from "@testing-library/react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";

describe("Sidebar", () => {
  it("keeps labels visible in the static variant when closed", () => {
    render(
      <Sidebar.Static open={false} setOpen={() => {}}>
        <SidebarBody>
          <SidebarLink
            link={{
              label: "dashboard",
              href: "/dashboard",
              icon: <span>icon</span>,
            }}
          />
        </SidebarBody>
      </Sidebar.Static>,
    );

    expect(screen.getByText("dashboard")).toBeVisible();
  });
});
