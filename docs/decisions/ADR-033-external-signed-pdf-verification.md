# ADR-033: External Signed PDF Verification

External PDFs are stored privately as quarantined uploads, validated as PDF bytes, hashed and reviewed by an authorized tenant user. `MALWARE_SCANNER=none` means manual review only and never means the file is malware-safe. The CRM does not validate embedded certificates or the legal validity of a third-party signature.
