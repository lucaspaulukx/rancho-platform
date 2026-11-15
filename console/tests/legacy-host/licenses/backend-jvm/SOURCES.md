# JVM notice sources

The runtime checksum list binds these notices to the shipped JARs. The notices below retain their upstream content.

| Shipped JAR | Notice and source |
| --- | --- |
| `annotations-2.0.0.jar` | FindBugs Annotations 2.0.0 includes FindBugs, JCIP and JSR-305 classes. Its three license texts come from `findbugs/licenses/` at [FindBugs release commit a47df12](https://github.com/findbugsproject/findbugs/tree/a47df12fec28210439d58acc1233299410036678/findbugs/licenses). |
| `aspectjweaver-1.7.4.jar` | The upstream distribution notice is `docs/dist/LICENSE-AspectJ.html` at [AspectJ release commit 7d8b14c](https://github.com/eclipse-aspectj/aspectj/tree/7d8b14cc98a2f377c83156f099598623f4623a49/docs/dist). The archived notice references ASM 2.2.1. The pinned build uses relocated ASM 4.0 classes. The license for that version comes from the header of `ClassReader.java`. [ASM build reference](https://github.com/eclipse-aspectj/aspectj/blob/7d8b14cc98a2f377c83156f099598623f4623a49/lib/asm/build.xml) · [ASM 4.0 source](https://repo.maven.apache.org/maven2/org/ow2/asm/asm/4.0/asm-4.0-sources.jar) |
| `jersey-apache-connector-2.11.jar` | The license and third-party readme come from [Jersey 2.11 commit a2228f3](https://github.com/javaee/jersey/tree/a2228f3ca6491afaa2571bdfef7ab50376c891fa). |
| `hk2-utils-2.3.0-b05.jar` | The HK2 and bundled Tiger Types source headers identify the same GlassFish dual license text included with Jersey. [HK2 2.3.0-b05](https://github.com/javaee/hk2/tree/91481dde105e468e8ff8089253d00099e057c7be) · [Tiger Types 1.4](https://github.com/kohsuke/tiger-types/tree/f9b977af0ac02c99e25b358f759658d8b431b0f1) |

The release inventory records remaining notices and corresponding-source review separately.
