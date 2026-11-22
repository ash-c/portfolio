import { Box, Container, Heading, HStack, SimpleGrid, Tag, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { getProjectDetailPath, projects, type Project } from '../data/projects';

const cardRows = 4;

const cardStyles = {
  display: 'grid',
  gridTemplateRows: 'subgrid',
  gridRow: `span ${cardRows}`,
  mb: 6,
  bg: 'white',
  borderWidth: '1px',
  borderColor: 'gray.200',
  borderRadius: 'lg',
  p: 6,
} as const;

const linkedCardStyles = {
  ...cardStyles,
  position: 'relative',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  _hover: { borderColor: 'primary.300', boxShadow: 'md' },
  '&:has(a:focus-visible)': {
    outline: '3px solid',
    outlineColor: 'primary.500',
    outlineOffset: '2px',
  },
} as const;

// The ::after overlay stretches the title link across the whole card, so the card stays
// clickable while the link's accessible name matches its visible text.
const stretchedLinkStyles = {
  color: 'inherit',
  textDecoration: 'none',
  outline: 'none',
  _after: { content: '""', position: 'absolute', inset: 0, borderRadius: 'lg' },
} as const;

type CardLink = {
  href: string;
  cue: string;
  external?: boolean;
};

const cardLinkFor = (project: Project): CardLink | undefined => {
  const detailPath = getProjectDetailPath(project);
  if (detailPath) {
    return { href: detailPath, cue: 'Read more' };
  }
  if (project.link) {
    return { href: project.link, cue: 'View Project', external: true };
  }
  return undefined;
};

const ProjectCardTitle = ({ project, link }: { project: Project; link?: CardLink }) => {
  if (!link) {
    return project.title;
  }
  if (link.external) {
    return (
      <Box asChild {...stretchedLinkStyles}>
        <a href={link.href} target="_blank" rel="noopener noreferrer">
          {project.title}
        </a>
      </Box>
    );
  }
  return (
    <Box asChild {...stretchedLinkStyles}>
      <RouterLink to={link.href}>{project.title}</RouterLink>
    </Box>
  );
};

const ProjectCard = ({ project }: { project: Project }) => {
  const link = cardLinkFor(project);

  return (
    <Box {...(link ? linkedCardStyles : cardStyles)}>
      <Heading as="h2" size="md" mb={2}>
        <ProjectCardTitle project={project} link={link} />
      </Heading>
      <Text mb={3}>{project.description}</Text>
      <HStack gap={2} flexWrap="wrap" alignSelf="end">
        {project.techStack.map((tech) => (
          <Tag.Root key={tech} size="sm" variant="subtle" bg="highlight.100" color="highlight.900">
            <Tag.Label>{tech}</Tag.Label>
          </Tag.Root>
        ))}
      </HStack>
      <Box pt={3} _empty={{ pt: 0 }}>
        {link && (
          <Text as="span" fontWeight="semibold" color="primary.600">
            {link.cue}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export const ProjectsPage = () => {
  return (
    <Container maxW="6xl" px={4} py={8}>
      <VStack align="flex-start" gap={6}>
        <Heading as="h1" size="lg">
          Projects
        </Heading>
        <Text color="gray.500" maxW="2xl">
          A selection of my personal projects and professional work.
        </Text>

        <SimpleGrid columns={{ base: 1, md: 2 }} columnGap={6} rowGap={0} w="full">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </SimpleGrid>
      </VStack>
    </Container>
  );
};
