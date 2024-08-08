import { RichPathData } from '@/components/breadcrumb/breadcrumb';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export function Crumbs({ path }: { path: RichPathData[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {path.map((crumb, index) =>
          index < path.length - 1 ? (
            <>
              <BreadcrumbItem key={index}>
                <BreadcrumbLink href={crumb.href}>{crumb.title}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : (
            <BreadcrumbPage key={index}>{crumb.title}</BreadcrumbPage>
          )
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
