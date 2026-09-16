# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
## Purpose
Upload historical sales and a Product Id to Item ID master. Aggregate Gross Units and project an additional 25%. Download item-wise reports.
## Constraints
Vercel and Supabase ready. Required sales fields: Product Id, Order Date, SKU ID, Gross Units, Cancellation Units, Final Sale Units.
## Implementation assumptions
CSV/XLSX support, whole-unit round-up, per-user private cloud workspace, replacing uploads rather than appending. No date normalization of projection: it applies to the uploaded period.
