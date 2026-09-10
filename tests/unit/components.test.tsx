// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActivityRow } from "@/components/activity-row";
import { DocumentList, describe as describeDoc } from "@/components/document-list";
import { FileDropzone, formatSize, sameFile } from "@/components/file-dropzone";
import { ImagePicker } from "@/components/image-picker";
import type { ActivityDocument, ActivitySummary } from "@/lib/types";
import { initials } from "@/lib/types";

const activity: ActivitySummary = {
  id: 42,
  title: "El post-it positivo",
  learningObjective: "Identificar las cualidades positivas de cada persona.",
  coverUrl: "https://bucket.s3.amazonaws.com/actividades/avatars/post-it.png?X-Amz-Signature=x",
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

describe("FileDropzone previews", () => {
  function pick(input: HTMLInputElement, ...files: File[]) {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    fireEvent.change(input);
  }

  it("shows the image itself and the extension for everything else", () => {
    render(<FileDropzone />);
    const input = screen.getByLabelText("Documentos de la actividad") as HTMLInputElement;

    pick(
      input,
      new File(["a"], "mural.png", { type: "image/png" }),
      new File(["b"], "planificacion.docx", { type: "" }),
    );

    const thumb = document.querySelector("img");
    expect(thumb?.getAttribute("src")).toMatch(/^blob:/);
    // A DOCX has nothing to render, so the badge names the format instead.
    expect(screen.getByText("DOCX")).toBeInTheDocument();
  });

  it("releases the preview when the file is removed", async () => {
    const user = userEvent.setup();
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    render(<FileDropzone />);
    const input = screen.getByLabelText("Documentos de la actividad") as HTMLInputElement;

    pick(input, new File(["a"], "mural.png", { type: "image/png" }));
    const url = document.querySelector("img")!.getAttribute("src")!;

    await user.click(screen.getByRole("button", { name: "Quitar" }));

    // Without this the blob stays alive for the rest of the session.
    expect(revoke).toHaveBeenCalledWith(url);
    revoke.mockRestore();
  });
});

describe("ImagePicker", () => {
  function choose(input: HTMLInputElement, file: File) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    fireEvent.change(input);
  }

  it("previews the chosen cover", () => {
    render(
      <ImagePicker
        name="cover"
        label="Portada de la actividad"
        alt="Vista previa de la portada"
        hint="Opcional"
      />,
    );
    const input = screen.getByLabelText("Portada de la actividad") as HTMLInputElement;

    choose(input, new File(["a"], "portada.jpg", { type: "image/jpeg" }));

    expect(screen.getByAltText("Vista previa de la portada")).toBeInTheDocument();
    expect(screen.getByText(/portada\.jpg/)).toBeInTheDocument();
    expect(input.name).toBe("cover");
  });

  it("refuses a file that is not an image, and keeps it off the input", () => {
    render(
      <ImagePicker
        name="cover"
        label="Portada de la actividad"
        alt="Vista previa de la portada"
        hint="Opcional"
      />,
    );
    const input = screen.getByLabelText("Portada de la actividad") as HTMLInputElement;

    choose(input, new File(["a"], "planificacion.docx", { type: "" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Tiene que ser una imagen");
    expect(input.value).toBe("");
    expect(screen.queryByAltText("Vista previa de la portada")).not.toBeInTheDocument();
  });

  it("shows the photo the account already has, until a new one is picked", () => {
    render(
      <ImagePicker
        name="avatar"
        label="Foto de perfil"
        alt="Tu foto de perfil"
        hint="Opcional"
        currentUrl="https://bucket.s3.amazonaws.com/users/avatars/a.jpg?X-Amz-Signature=x"
      />,
    );

    const preview = screen.getByAltText("Tu foto de perfil");
    expect(preview.getAttribute("src")).toContain("/users/avatars/a.jpg");
    // Nothing has been chosen yet, so there is nothing to undo.
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar imagen" })).toBeInTheDocument();
  });

  it("swaps the existing photo for the picked one, and can undo back to it", async () => {
    const user = userEvent.setup();
    render(
      <ImagePicker
        name="avatar"
        label="Foto de perfil"
        alt="Tu foto de perfil"
        hint="Opcional"
        currentUrl="https://bucket.s3.amazonaws.com/users/avatars/a.jpg"
      />,
    );
    const input = screen.getByLabelText("Foto de perfil") as HTMLInputElement;

    choose(input, new File(["a"], "nueva.png", { type: "image/png" }));
    expect(screen.getByAltText("Tu foto de perfil").getAttribute("src")).toMatch(/^blob:/);

    await user.click(screen.getByRole("button", { name: "Deshacer" }));

    // Back to the stored photo, and the input no longer carries a file.
    expect(screen.getByAltText("Tu foto de perfil").getAttribute("src")).toContain(
      "/users/avatars/a.jpg",
    );
    expect(input.value).toBe("");
  });
});

describe("DocumentList", () => {
  const doc = (over: Partial<ActivityDocument>): ActivityDocument => ({
    id: 1,
    name: "Guía",
    url: "https://bucket.s3.amazonaws.com/actividades/recursos/a.pdf?X-Amz-Signature=x",
    kind: "Guía",
    preview: "pdf",
    format: "PDF",
    ...over,
  });

  it("offers a preview only for what a browser can render", () => {
    render(
      <DocumentList
        activityId={42}
        signedIn={false}
        documents={[
          doc({ id: 1, name: "Guía en PDF" }),
          doc({ id: 2, name: "Planificación", preview: null, format: "DOCX" }),
        ]}
      />,
    );

    // One "Ver" button, for the PDF; the DOCX only gets its download.
    expect(screen.getAllByRole("button", { name: "Ver" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Descargar ↓" })).toHaveLength(2);
  });

  it("thumbnails an image without waiting to be asked", () => {
    render(
      <DocumentList
        activityId={42}
        signedIn={false}
        documents={[doc({ name: "Mural", preview: "image", format: "JPG" })]}
      />,
    );

    expect(screen.getByRole("button", { name: "Ver Mural en grande" })).toBeInTheDocument();
  });

  it("does not print the format twice when it repeats the type", () => {
    // The activity's own PDF arrives as kind "PDF" and format "PDF".
    expect(describeDoc({ kind: "PDF", format: "PDF" })).toBe("PDF");
    expect(describeDoc({ kind: "Guía", format: "PDF" })).toBe("Guía · PDF");
    expect(describeDoc({ kind: null, format: "DOCX" })).toBe("DOCX");
    expect(describeDoc({ kind: null, format: null })).toBe("Archivo");
  });

  it("says so when there is nothing attached", () => {
    render(<DocumentList activityId={42} signedIn={false} documents={[]} />);
    expect(screen.getByText("Esta actividad no tiene archivos.")).toBeInTheDocument();
  });

  it("marks a file with no reference as unavailable", () => {
    render(
      <DocumentList
        activityId={42}
        signedIn={false}
        documents={[doc({ url: null, preview: null, format: null })]}
      />,
    );
    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver" })).not.toBeInTheDocument();
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
