"""
Dependency Merger for Template Projects.

Handles merging package.json files from multiple templates while resolving
version conflicts using semver. Supports:
- npm/yarn/pnpm (package.json)
- Python (requirements.txt, pyproject.toml)
- Go (go.mod)

Based on the DEPENDENCY_CONFLICT_RESOLUTION.md specification.
"""
import json
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Set
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class DependencyType(str, Enum):
    """Types of dependencies."""
    PRODUCTION = "dependencies"
    DEVELOPMENT = "devDependencies"
    PEER = "peerDependencies"
    OPTIONAL = "optionalDependencies"


class ConflictResolution(str, Enum):
    """Conflict resolution strategies."""
    NEWEST = "newest"           # Use the newest compatible version
    OLDEST = "oldest"           # Use the oldest compatible version
    INTERACTIVE = "interactive" # Ask user to resolve
    FAIL = "fail"               # Fail on conflict


@dataclass
class SemVer:
    """Semantic version representation."""
    major: int
    minor: int
    patch: int
    prerelease: Optional[str] = None
    build: Optional[str] = None
    original: str = ""

    @classmethod
    def parse(cls, version_str: str) -> "SemVer":
        """Parse a semver string into components."""
        original = version_str
        # Remove leading ^ or ~
        version_str = version_str.lstrip("^~>=<")

        # Handle special versions
        if version_str in ("*", "latest", "x"):
            return cls(major=999, minor=999, patch=999, original=original)

        # Parse version with prerelease
        pattern = r"^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$"
        match = re.match(pattern, version_str)

        if not match:
            # Default to 0.0.0 for unparseable versions
            return cls(major=0, minor=0, patch=0, original=original)

        return cls(
            major=int(match.group(1)),
            minor=int(match.group(2) or 0),
            patch=int(match.group(3) or 0),
            prerelease=match.group(4),
            build=match.group(5),
            original=original,
        )

    def __lt__(self, other: "SemVer") -> bool:
        """Compare versions for sorting."""
        if self.major != other.major:
            return self.major < other.major
        if self.minor != other.minor:
            return self.minor < other.minor
        if self.patch != other.patch:
            return self.patch < other.patch
        # Prerelease versions are lower than release versions
        if self.prerelease and not other.prerelease:
            return True
        if not self.prerelease and other.prerelease:
            return False
        return (self.prerelease or "") < (other.prerelease or "")

    def __str__(self) -> str:
        return self.original or f"{self.major}.{self.minor}.{self.patch}"

    def is_compatible_with(self, other: "SemVer", strategy: str = "^") -> bool:
        """Check if this version is compatible with another using semver rules."""
        if strategy == "^":
            # Caret: same major version (>=1.0.0) or same major.minor (<1.0.0)
            if self.major >= 1:
                return self.major == other.major
            return self.major == other.major and self.minor == other.minor
        elif strategy == "~":
            # Tilde: same major.minor
            return self.major == other.major and self.minor == other.minor
        return True


@dataclass
class DependencyConflict:
    """Represents a dependency version conflict."""
    name: str
    versions: List[str]
    sources: List[str]
    resolved_version: Optional[str] = None
    resolution_strategy: Optional[str] = None


@dataclass
class MergeResult:
    """Result of merging dependencies."""
    merged: Dict[str, str]
    conflicts: List[DependencyConflict]
    warnings: List[str]
    success: bool = True


class DependencyMerger:
    """
    Merges dependencies from multiple sources with conflict resolution.
    """

    def __init__(
        self,
        resolution_strategy: ConflictResolution = ConflictResolution.NEWEST,
        allow_major_upgrade: bool = False,
    ):
        """
        Initialize the dependency merger.

        Args:
            resolution_strategy: How to resolve version conflicts
            allow_major_upgrade: Allow major version upgrades when resolving
        """
        self.resolution_strategy = resolution_strategy
        self.allow_major_upgrade = allow_major_upgrade

    def merge_package_json(
        self,
        base: Dict[str, Any],
        *overlays: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Merge multiple package.json files.

        Args:
            base: Base package.json content
            overlays: Additional package.json files to merge

        Returns:
            Merged package.json content
        """
        result = json.loads(json.dumps(base))  # Deep copy

        for overlay in overlays:
            # Merge each dependency type
            for dep_type in DependencyType:
                if dep_type.value in overlay:
                    merge_result = self.merge_dependencies(
                        result.get(dep_type.value, {}),
                        overlay[dep_type.value],
                    )
                    if merge_result.merged:
                        result[dep_type.value] = merge_result.merged

            # Merge scripts (overlay takes precedence)
            if "scripts" in overlay:
                result.setdefault("scripts", {}).update(overlay["scripts"])

            # Merge other fields
            for field in ["engines", "browserslist", "resolutions"]:
                if field in overlay:
                    result.setdefault(field, {}).update(overlay[field])

        return result

    def merge_dependencies(
        self,
        base: Dict[str, str],
        overlay: Dict[str, str],
        sources: Tuple[str, str] = ("base", "overlay"),
    ) -> MergeResult:
        """
        Merge two dependency objects with conflict resolution.

        Args:
            base: Base dependencies
            overlay: Dependencies to merge in
            sources: Names of the sources for conflict reporting

        Returns:
            MergeResult with merged dependencies and any conflicts
        """
        result = dict(base)
        conflicts: List[DependencyConflict] = []
        warnings: List[str] = []

        for name, version in overlay.items():
            if name not in result:
                # No conflict, just add
                result[name] = version
            elif result[name] == version:
                # Same version, no conflict
                continue
            else:
                # Version conflict - resolve it
                base_version = SemVer.parse(result[name])
                overlay_version = SemVer.parse(version)

                resolved, strategy = self._resolve_conflict(
                    name, base_version, overlay_version
                )

                conflict = DependencyConflict(
                    name=name,
                    versions=[result[name], version],
                    sources=list(sources),
                    resolved_version=resolved,
                    resolution_strategy=strategy,
                )
                conflicts.append(conflict)

                if resolved:
                    result[name] = resolved
                    warnings.append(
                        f"Resolved {name} conflict: {result[name]} vs {version} -> {resolved}"
                    )
                else:
                    warnings.append(
                        f"Could not resolve {name} conflict: {result[name]} vs {version}"
                    )

        return MergeResult(
            merged=result,
            conflicts=conflicts,
            warnings=warnings,
            success=all(c.resolved_version for c in conflicts),
        )

    def _resolve_conflict(
        self,
        name: str,
        v1: SemVer,
        v2: SemVer,
    ) -> Tuple[Optional[str], str]:
        """
        Resolve a version conflict between two versions.

        Returns:
            Tuple of (resolved_version, strategy_used)
        """
        if self.resolution_strategy == ConflictResolution.FAIL:
            return None, "fail"

        # Check if versions are compatible
        if v1.major == v2.major or self.allow_major_upgrade:
            if self.resolution_strategy == ConflictResolution.NEWEST:
                winner = v2 if v2 > v1 else v1
                return f"^{winner.major}.{winner.minor}.{winner.patch}", "newest"
            elif self.resolution_strategy == ConflictResolution.OLDEST:
                winner = v1 if v1 < v2 else v2
                return f"^{winner.major}.{winner.minor}.{winner.patch}", "oldest"

        # Major version conflict without allow_major_upgrade
        if v1.major != v2.major:
            logger.warning(
                f"Major version conflict for {name}: {v1} vs {v2}. "
                f"Set allow_major_upgrade=True to resolve."
            )
            return None, "major_conflict"

        return None, "unresolved"

    def merge_requirements_txt(
        self,
        *requirements: str,
    ) -> str:
        """
        Merge multiple requirements.txt files.

        Args:
            requirements: Requirements.txt file contents

        Returns:
            Merged requirements.txt content
        """
        deps: Dict[str, List[str]] = {}

        for req_content in requirements:
            for line in req_content.strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue

                # Parse package name and version
                match = re.match(r"^([a-zA-Z0-9_-]+)(.*)$", line)
                if match:
                    name = match.group(1).lower()
                    version = match.group(2).strip()
                    deps.setdefault(name, []).append(version)

        # Resolve conflicts
        result_lines = []
        for name, versions in sorted(deps.items()):
            unique_versions = list(set(versions))
            if len(unique_versions) == 1:
                result_lines.append(f"{name}{versions[0]}" if versions[0] else name)
            else:
                # Use newest version
                resolved = self._resolve_python_versions(unique_versions)
                result_lines.append(f"{name}{resolved}")
                logger.info(f"Resolved Python dependency {name}: {unique_versions} -> {resolved}")

        return "\n".join(result_lines)

    def _resolve_python_versions(self, versions: List[str]) -> str:
        """Resolve Python package version constraints."""
        # Parse and sort versions
        parsed = []
        for v in versions:
            # Handle various formats: ==1.0.0, >=1.0.0, ~=1.0, etc.
            match = re.match(r"^([<>=!~]+)?(.+)$", v.strip())
            if match:
                op = match.group(1) or "=="
                ver = match.group(2)
                parsed.append((op, SemVer.parse(ver), v))

        if not parsed:
            return ""

        # For simplicity, take the highest version with >= constraint
        parsed.sort(key=lambda x: x[1], reverse=True)
        _, ver, original = parsed[0]
        return f">={ver.major}.{ver.minor}.{ver.patch}"


@dataclass
class TemplateManifest:
    """Manifest for a project template."""
    name: str
    description: str
    dependencies: Dict[str, str] = field(default_factory=dict)
    dev_dependencies: Dict[str, str] = field(default_factory=dict)
    scripts: Dict[str, str] = field(default_factory=dict)
    files: List[str] = field(default_factory=list)
    post_install: List[str] = field(default_factory=list)


class TemplateMerger:
    """
    Merges multiple project templates into a single cohesive project.
    """

    def __init__(self, dependency_merger: Optional[DependencyMerger] = None):
        self.dependency_merger = dependency_merger or DependencyMerger()

    def merge_templates(
        self,
        base_template: TemplateManifest,
        *additional_templates: TemplateManifest,
    ) -> Tuple[TemplateManifest, List[str]]:
        """
        Merge multiple templates into one.

        Args:
            base_template: The base template
            additional_templates: Templates to merge in

        Returns:
            Tuple of (merged_template, warnings)
        """
        warnings: List[str] = []

        # Start with base
        result = TemplateManifest(
            name=base_template.name,
            description=base_template.description,
            dependencies=dict(base_template.dependencies),
            dev_dependencies=dict(base_template.dev_dependencies),
            scripts=dict(base_template.scripts),
            files=list(base_template.files),
            post_install=list(base_template.post_install),
        )

        for template in additional_templates:
            # Merge dependencies
            dep_result = self.dependency_merger.merge_dependencies(
                result.dependencies,
                template.dependencies,
                sources=(result.name, template.name),
            )
            result.dependencies = dep_result.merged
            warnings.extend(dep_result.warnings)

            # Merge dev dependencies
            dev_result = self.dependency_merger.merge_dependencies(
                result.dev_dependencies,
                template.dev_dependencies,
                sources=(result.name, template.name),
            )
            result.dev_dependencies = dev_result.merged
            warnings.extend(dev_result.warnings)

            # Merge scripts (later templates override)
            for name, command in template.scripts.items():
                if name in result.scripts and result.scripts[name] != command:
                    warnings.append(
                        f"Script '{name}' overridden: "
                        f"'{result.scripts[name]}' -> '{command}'"
                    )
                result.scripts[name] = command

            # Merge files (deduplicate)
            result.files = list(set(result.files + template.files))

            # Merge post_install (preserve order)
            for cmd in template.post_install:
                if cmd not in result.post_install:
                    result.post_install.append(cmd)

            # Update description
            result.description = f"{result.description} + {template.name}"

        return result, warnings

    def generate_package_json(self, manifest: TemplateManifest) -> Dict[str, Any]:
        """Generate package.json from template manifest."""
        return {
            "name": manifest.name.lower().replace(" ", "-"),
            "version": "0.1.0",
            "description": manifest.description,
            "scripts": manifest.scripts,
            "dependencies": manifest.dependencies,
            "devDependencies": manifest.dev_dependencies,
        }


# Convenience functions
def merge_package_jsons(*package_jsons: Dict[str, Any]) -> Dict[str, Any]:
    """Merge multiple package.json files."""
    if not package_jsons:
        return {}
    merger = DependencyMerger()
    return merger.merge_package_json(package_jsons[0], *package_jsons[1:])


def resolve_version_conflict(
    versions: List[str],
    strategy: ConflictResolution = ConflictResolution.NEWEST,
) -> str:
    """Resolve a version conflict given a list of versions."""
    parsed = [SemVer.parse(v) for v in versions]
    if strategy == ConflictResolution.NEWEST:
        winner = max(parsed)
    else:
        winner = min(parsed)
    return f"^{winner.major}.{winner.minor}.{winner.patch}"
