// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ActivityRow } from "@/components/activity-row";
import { FileDropzone, formatSize, sameFile } from "@/components/file-dropzone";
import type { ActivitySummary } from "@/lib/types";
import { initials } from "@/lib/types";

const activity: ActivitySummary = {
  id: 42,
  title: "El post-it positivo",
  learningObjective: "Identificar las cualidades positivas de cada persona.",
  durationMinutes: 45,
  createdAt: "2024-05-01T10:00:00Z",
  author: { id: 9, name: "Angela Palma", avatarUrl: null },
  subjects: ["Orientación"],
  grades: ["9 a 10 años"],
  resourceTypes: ["Guía"],
  documentCount: 2,
  savedCount: 3,
  downloadCount: 11,
};

describe("ActivityRow", () => {
  it("links to the activity and shows its meta line", () => {
    render(<ActivityRow activity={activity} />);

    const link = screen.getByRole("link", { name: /El post-it positivo/ });
    expect(link).toHaveAttribute("href", "/actividades/detalle/42");
    expect(screen.getByText("ORIENTACIÓN · 9 A 10 AÑOS · 45 MIN")).toBeInTheDocument();
    expect(screen.getByText("2 documentos · Guía · 11 descargas")).toBeInTheDocument();
  });

  it("drops the objective on the profile list", () => {
    render(<ActivityRow activity={activity} showObjective={false} />);
    expect(screen.queryByText(/Identificar las cualidades/)).not.toBeInTheDocument();
  });

  it("renders an activity with no subject, grade or duration", () => {
    render(
      <ActivityRow
        activity={{ ...activity, subjects: [], grades: [], durationMinutes: null }}
      />,
    );
    expect(screen.getByRole("link", { name: /El post-it positivo/ })).toBeInTheDocument();
  });
});

describe("FileDropzone", () => {
  it("formats sizes the way the design shows them", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(3.4 * 1024 * 1024)).toBe("3,4 MB");
  });

  it("treats a re-picked file as the same file", () => {
    const a = new File(["x"], "guia.pdf", { lastModified: 1 });
    const b = new File(["x"], "guia.pdf", { lastModified: 1 });
    const c = new File(["x"], "guia.pdf", { lastModified: 2 });
    expect(sameFile(a, b)).toBe(true);
    expect(sameFile(a, c)).toBe(false);
  });

  /**
   * Drives the input the way the browser does — a change event carrying a
   * FileList. `userEvent.upload` redefines `files` on the element itself with a
   * getter only, which would make the component's write-back untestable.
   */
  function pick(input: HTMLInputElement, ...files: File[]) {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    fireEvent.change(input);
  }

  it("keeps the picked files on the input, so the form actually submits them", () => {
    render(<FileDropzone />);
    const input = screen.getByLabelText("Documentos de la actividad") as HTMLInputElement;

    pick(input, new File(["contenido"], "guia.pdf", { type: "application/pdf" }));

    expect(input.files).toHaveLength(1);
    expect(input.name).toBe("files");
    expect(screen.getByText("guia.pdf")).toBeInTheDocument();
  });

  it("merges a second pick instead of replacing the first", () => {
    render(<FileDropzone />);
    const input = screen.getByLabelText("Documentos de la actividad") as HTMLInputElement;

    pick(input, new File(["a"], "guia.pdf", { type: "application/pdf" }));
    pick(input, new File(["b"], "rubrica.pdf", { type: "application/pdf" }));

    expect(input.files).toHaveLength(2);
    expect(screen.getByText("guia.pdf")).toBeInTheDocument();
    expect(screen.getByText("rubrica.pdf")).toBeInTheDocument();
  });

  it("rejects a file over 25 MB and says which one", () => {
    render(<FileDropzone />);
    const input = screen.getByLabelText("Documentos de la actividad") as HTMLInputElement;

    const huge = new File(["x"], "enorme.pdf", { type: "application/pdf" });
    Object.defineProperty(huge, "size", { value: 26 * 1024 * 1024 });
    pick(input, huge);

    expect(screen.getByRole("alert")).toHaveTextContent("enorme.pdf supera los 25 MB.");
    expect(input.files).toHaveLength(0);
  });

  it("removes a file from the input as well as from the list", async () => {
    const user = userEvent.setup();
    render(<FileDropzone />);
    const input = screen.getByLabelText("Documentos de la actividad") as HTMLInputElement;

    pick(input, new File(["c"], "guia.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Quitar" }));

    expect(input.files).toHaveLength(0);
    expect(screen.queryByText("guia.pdf")).not.toBeInTheDocument();
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Angela Palma")).toBe("AP");
    expect(initials("Constanza Belén García Castagnoli")).toBe("CC");
    expect(initials("Angela")).toBe("A");
    expect(initials("   ")).toBe("?");
  });
});
