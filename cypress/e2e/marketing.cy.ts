describe("Marketing", () => {
  it("loads the landing page", () => {
    cy.visit("/");
    cy.contains("Never lose the thread");
  });
});
