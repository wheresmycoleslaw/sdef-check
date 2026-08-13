package com.sithix;

import java.io.FileInputStream;
import org.mpxj.ProjectFile;
import org.mpxj.primavera.PrimaveraXERFileReader;
import org.mpxj.writer.FileFormat;
import org.mpxj.writer.UniversalProjectWriter;

public final class XerToSdef {
  public static void main(String[] args) throws Exception {
    if (args.length != 2) {
      throw new IllegalArgumentException("usage: XerToSdef input.xer output.sdef");
    }

    PrimaveraXERFileReader reader = new PrimaveraXERFileReader();
    reader.setProjectID(4829);
    reader.setIgnoreErrors(false);

    ProjectFile project;
    try (FileInputStream stream = new FileInputStream(args[0])) {
      project = reader.read(stream);
    }

    if (project == null) {
      throw new IllegalStateException("MPXJ did not return project 4829");
    }

    new UniversalProjectWriter(FileFormat.SDEF).write(project, args[1]);

    System.out.println("project=" + project.getProjectProperties().getName());
    System.out.println("tasks=" + project.getTasks().size());
    System.out.println("calendars=" + project.getCalendars().size());
    System.out.println("output=" + args[1]);
  }
}
