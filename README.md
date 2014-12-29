# Mongoose Groups

Mongoose Groups provides NodeJS projects (that use Mongoose) a means of defining and querying group enclosures, for example, does A contain B.  In the trivial case, this would not require anything beyond Mongoose's schema references or subdocuments functionality.  However, more complex applications have additional requirements:

- Multi level group enclosure (A contains B contains C)
- Multi leaf, multi root (A contains B, C contains B, C contains D)
- Diamond patterns (A contains B, A contains C, B contains D, C contains D)
- Cyclical containment detection (A contains B contains A disallowed)
- Efficient single queries without "reference walking" (get all groups containing A, get all groups A contains, in one shot)
- Plugin architecture so that both groups and group members can utilize your existing schemas

### An example


