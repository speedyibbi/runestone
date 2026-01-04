import type { ExtractedLink, ExtractedHashtag } from '@/interfaces/graph'

/**
 * Resolver function to look up note UUID by title
 */
export type TitleToUuidResolver = (title: string) => Promise<string | null>

/**
 * Resolver function to look up note title by UUID
 */
export type UuidToTitleResolver = (uuid: string) => Promise<string | null>

/**
 * LinkExtractor parses markdown content to extract links and hashtags
 */
export default class LinkExtractorService {
  /**
   * Extract all links and hashtags from markdown content
   */
  static async extract(
    sourceUuid: string,
    content: string,
    resolveTitleToUuid: TitleToUuidResolver,
    resolveUuidToTitle: UuidToTitleResolver,
  ): Promise<{
    links: ExtractedLink[]
    hashtags: ExtractedHashtag[]
  }> {
    const links: ExtractedLink[] = []
    const hashtags: ExtractedHashtag[] = []

    // Extract wiki-style links: [[Title]] or [[Title|Display Text]]
    const wikiLinks = await this.extractWikiLinks(sourceUuid, content, resolveTitleToUuid)
    links.push(...wikiLinks)

    // Extract markdown links: [text](url) - only internal links
    const markdownLinks = await this.extractMarkdownLinks(sourceUuid, content, resolveUuidToTitle)
    links.push(...markdownLinks)

    // Extract hashtags: #tag or #multi-word-tag
    const extractedHashtags = this.extractHashtags(sourceUuid, content)
    hashtags.push(...extractedHashtags)

    return { links, hashtags }
  }

  /**
   * Extract wiki-style links: [[Note Title]] or [[Note Title|Display Text]]
   */
  private static async extractWikiLinks(
    sourceUuid: string,
    content: string,
    resolveTitleToUuid: TitleToUuidResolver,
  ): Promise<ExtractedLink[]> {
    const links: ExtractedLink[] = []
    // Pattern: [[Title]] or [[Title|Display Text]]
    const wikiLinkPattern = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g

    let match
    const promises: Promise<void>[] = []

    while ((match = wikiLinkPattern.exec(content)) !== null) {
      const targetTitle = match[1].trim()
      const displayText = match[2]?.trim() || targetTitle

      // Resolve title to UUID using resolver
      promises.push(
        resolveTitleToUuid(targetTitle).then((targetUuid) => {
          if (targetUuid) {
            links.push({
              type: 'wiki',
              sourceUuid,
              targetUuid,
              targetTitle: targetTitle,
              linkText: displayText,
            })
          } else {
            // Link to non-existent note - still track it but without UUID
            links.push({
              type: 'wiki',
              sourceUuid,
              targetTitle: targetTitle,
              linkText: displayText,
            })
          }
        }),
      )
    }

    await Promise.all(promises)
    return links
  }

  /**
   * Extract markdown links: [text](url)
   * Only tracks internal links with rune://uuid format
   */
  private static async extractMarkdownLinks(
    sourceUuid: string,
    content: string,
    resolveUuidToTitle: UuidToTitleResolver,
  ): Promise<ExtractedLink[]> {
    const links: ExtractedLink[] = []
    // Pattern: [text](url)
    const markdownLinkPattern = /\[([^\]]+?)\]\(([^)]+?)\)/g

    let match
    const promises: Promise<void>[] = []

    while ((match = markdownLinkPattern.exec(content)) !== null) {
      const linkText = match[1].trim()
      const url = match[2].trim()

      // rune://uuid link format
      const runeProtocolPattern =
        /^rune:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

      if (runeProtocolPattern.test(url)) {
        const uuidMatch = url.match(runeProtocolPattern)
        if (uuidMatch) {
          const targetUuid = uuidMatch[1]
          // Resolve UUID to title using resolver
          promises.push(
            resolveUuidToTitle(targetUuid).then((targetTitle) => {
              if (targetTitle) {
                links.push({
                  type: 'markdown',
                  sourceUuid,
                  targetUuid,
                  targetTitle,
                  linkText,
                })
              }
            }),
          )
        }
      }
    }

    await Promise.all(promises)
    return links
  }

  /**
   * Extract hashtags: #tag or #multi-word-tag
   */
  private static extractHashtags(sourceUuid: string, content: string): ExtractedHashtag[] {
    const hashtags: ExtractedHashtag[] = []
    // Pattern: #tag (word characters and hyphens)
    // Exclude hashtags in code blocks, links, etc.
    const hashtagPattern = /(?:^|\s)#([\w-]+)/g

    const seen = new Set<string>()

    let match
    while ((match = hashtagPattern.exec(content)) !== null) {
      const hashtag = match[1].toLowerCase() // Normalize to lowercase

      // Skip if already seen in this note
      if (seen.has(hashtag)) {
        continue
      }

      seen.add(hashtag)
      hashtags.push({
        hashtag,
        sourceUuid,
      })
    }

    return hashtags
  }
}
