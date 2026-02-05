import { render, screen } from "@testing-library/react";
import { Table, Badge } from "@trail/ui";

describe("Table + Badge", () => {
  it("renders table structure", () => {
    render(
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Session</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Alpha</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("renders badge", () => {
    render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
