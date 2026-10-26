import type { Prisma } from 'generated/prisma/client';
/** Only work identity is selected. Never expose national ID, salary, date of birth or contact fields. */
export const officeSelect = {
  id: true,
  code: true,
  isEnabled: true,
  Versions: {
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      parentVersionId: true,
      nameKh: true,
      nameEn: true,
      effectiveFrom: true,
      effectiveTo: true,
      MinistryVersion: { select: { nameKh: true, nameEn: true } },
    },
  },
} satisfies Prisma.DepartmentSelect;
const employmentSelect = {
  id: true,
  profileId: true,
  positionTitle: true,
  startDate: true,
  endDate: true,
  status: true,
  DepartmentVersion: {
    select: { departmentId: true, Department: { select: officeSelect } },
  },
} satisfies Prisma.EmploymentHistorySelect;
export const workIdentitySelect = {
  id: true,
  name: true,
  image: true,
  profile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isEnabled: true,
      isHold: true,
      status: true,
      CurrentEmployment: { select: employmentSelect },
      Employments: { orderBy: { startDate: 'desc' }, select: employmentSelect },
    },
  },
} satisfies Prisma.UserSelect;
type Office = Prisma.DepartmentGetPayload<{ select: typeof officeSelect }>;
type Person = Prisma.UserGetPayload<{ select: typeof workIdentitySelect }>;
const workingStatuses = new Set(['ACTIVE', 'PROBATION', 'SECONDMENT']);
export function officeVersion(
  office: Office | null | undefined,
  at = new Date(),
) {
  return (
    office?.Versions.find(
      (version) =>
        version.effectiveFrom <= at &&
        (!version.effectiveTo || version.effectiveTo > at),
    ) ?? null
  );
}
export function officeIdentity(
  office: Office | null | undefined,
  at = new Date(),
) {
  const version = officeVersion(office, at);
  if (office?.isEnabled === false)
    return {
      departmentId: null,
      departmentVersionId: null,
      departmentName: null,
      ministryName: null,
    };
  return {
    departmentId: office?.id ?? null,
    departmentVersionId: version?.id ?? null,
    departmentName: version?.nameKh || version?.nameEn || office?.code || null,
    ministryName:
      version?.MinistryVersion.nameKh ||
      version?.MinistryVersion.nameEn ||
      null,
  };
}
export function handlerIdentity(person: Person, at = new Date()) {
  const profile = person.profile;
  const day = new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const valid = (
    employment:
      | NonNullable<NonNullable<Person['profile']>['CurrentEmployment']>
      | null
      | undefined,
  ) =>
    Boolean(
      employment &&
      employment.profileId === profile?.id &&
      workingStatuses.has(employment.status) &&
      employment.startDate.toISOString().slice(0, 10) <= day &&
      (!employment.endDate ||
        employment.endDate.toISOString().slice(0, 10) >= day),
    );
  const eligible =
    profile?.isEnabled &&
    !profile.isHold &&
    workingStatuses.has(profile.status);
  const employment = eligible
    ? valid(profile.CurrentEmployment)
      ? profile.CurrentEmployment
      : profile.Employments.find(valid)
    : null;
  const office = employment?.DepartmentVersion.Department;
  return {
    id: person.id,
    name: person.name,
    image: person.image,
    profileName: profile
      ? [profile.lastName, profile.firstName].filter(Boolean).join(' ')
      : null,
    positionTitle: employment?.positionTitle ?? null,
    employmentId: employment?.id ?? null,
    ...officeIdentity(office, at),
  };
}

export function organizationOptions(offices: Office[], at = new Date()) {
  const versions = new Map(
    offices
      .flatMap((office) => office.Versions)
      .map((version) => [version.id, version]),
  );
  return offices.map((office) => {
    const current = officeVersion(office, at);
    const path: string[] = [];
    const seen = new Set<number>();
    let version = current;
    while (version && !seen.has(version.id)) {
      seen.add(version.id);
      path.unshift(version.nameKh || version.nameEn);
      version =
        version.parentVersionId == null
          ? null
          : (versions.get(version.parentVersionId) ?? null);
    }
    const identity = officeIdentity(office, at);
    return {
      id: office.id,
      name: [identity.ministryName, path.join(' / ') || office.code]
        .filter(Boolean)
        .join(' · '),
      ...identity,
    };
  });
}

/** Restrict the fallback history query to assignments effective on the Cambodia business date. */
export function workIdentityAt(at = new Date()) {
  const day = new Date(
    new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10) +
      'T00:00:00.000Z',
  );
  return {
    ...workIdentitySelect,
    profile: {
      select: {
        ...workIdentitySelect.profile.select,
        Employments: {
          ...workIdentitySelect.profile.select.Employments,
          where: {
            startDate: { lte: day },
            OR: [{ endDate: null }, { endDate: { gte: day } }],
            status: { in: ['ACTIVE', 'PROBATION', 'SECONDMENT'] },
          },
        },
      },
    },
  } satisfies Prisma.UserSelect;
}
